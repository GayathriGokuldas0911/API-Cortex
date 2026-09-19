import pytest
import asyncio
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database import Base
from app.models import User, Project, ApiConfig, MonitoringLog, Issue, SchemaValidationIssue
from app.services.schema_validator import validate_response_schema
from app.services.monitoring_service import execute_api_monitoring_check
from app.services.prometheus_metrics import record_monitoring_metrics, get_metrics_response
from app.main import app

# In-memory SQLite DB for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh database tables for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_client():
    """FastAPI TestClient instance."""
    return TestClient(app)


def test_schema_validator_success_and_drift():
    """Test schema validation for success, missing field, and type mismatch."""
    expected_schema = {
        "type": "object",
        "required": ["id", "username", "email"],
        "properties": {
            "id": {"type": "integer"},
            "username": {"type": "string"},
            "email": {"type": "string"},
            "age": {"type": "integer"}
        }
    }

    # 1. Valid payload
    valid_payload = {"id": 101, "username": "alice", "email": "alice@example.com", "age": 28}
    res_valid = validate_response_schema(valid_payload, expected_schema)
    assert res_valid.is_valid is True
    assert res_valid.has_drift is False

    # 2. Missing field drift
    missing_payload = {"id": 101, "username": "alice"}  # missing email
    res_missing = validate_response_schema(missing_payload, expected_schema)
    assert res_missing.has_drift is True
    assert any(d.drift_type == "MISSING_FIELD" and "email" in d.field_path for d in res_missing.drift_details)

    # 3. Type mismatch drift
    mismatch_payload = {"id": "101_string", "username": "alice", "email": "alice@example.com"}  # id is str, expected int
    res_mismatch = validate_response_schema(mismatch_payload, expected_schema)
    assert res_mismatch.has_drift is True
    assert any(d.drift_type == "TYPE_MISMATCH" and "id" in d.field_path for d in res_mismatch.drift_details)


def test_monitoring_execution_success_and_metrics(db_session, monkeypatch):
    """Test executing API monitoring check with mocked HTTPX response, checking logs and metrics."""
    async def _test():
        # Setup test User, Project, API
        user = User(email="test_p3@apicortex.io", hashed_password="hashed_password")
        db_session.add(user)
        db_session.commit()

        project = Project(user_id=user.id, name="Project Alpha")
        db_session.add(project)
        db_session.commit()

        api = ApiConfig(
            project_id=project.id,
            name="User Service Endpoint",
            url="https://mock-service.local/v1/users",
            method="GET",
            expected_status_code=200,
            expected_schema={"type": "object", "required": ["status"], "properties": {"status": {"type": "string"}}}
        )
        db_session.add(api)
        db_session.commit()

        # Mock HTTPX AsyncClient request
        async def mock_request(*args, **kwargs):
            class MockResponse:
                status_code = 200
                headers = {"content-type": "application/json"}
                text = '{"status": "active"}'

                def json(self):
                    return {"status": "active"}

            return MockResponse()

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_request)

        # Execute check
        result = await execute_api_monitoring_check(api, db_session)

        assert result["is_healthy"] is True
        assert result["status_code"] == 200
        assert result["project_id"] == project.id
        assert result["api_config_id"] == api.id

        # Verify MonitoringLog saved in DB
        log = db_session.query(MonitoringLog).filter(MonitoringLog.id == result["log_id"]).first()
        assert log is not None
        assert log.status_code == 200
        assert log.is_healthy is True

    asyncio.run(_test())


def test_monitoring_failure_creates_issue(db_session, monkeypatch):
    """Test unexpected status code creates an Issue in PostgreSQL linked to Project and API."""
    async def _test():
        user = User(email="test_err@apicortex.io", hashed_password="hashed_password")
        db_session.add(user)
        db_session.commit()

        project = Project(user_id=user.id, name="Payment Gateway Project")
        db_session.add(project)
        db_session.commit()

        api = ApiConfig(
            project_id=project.id,
            name="Process Payment Endpoint",
            url="https://mock-payment.local/pay",
            method="POST",
            expected_status_code=200
        )
        db_session.add(api)
        db_session.commit()

        # Mock 500 server error response
        async def mock_500_request(*args, **kwargs):
            class MockResponse:
                status_code = 500
                headers = {"content-type": "application/json"}
                text = '{"error": "Internal Server Error"}'

                def json(self):
                    return {"error": "Internal Server Error"}

            return MockResponse()

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_500_request)

        # Execute check
        result = await execute_api_monitoring_check(api, db_session)

        assert result["is_healthy"] is False
        assert result["issue_type"] == "HTTP_ERROR"
        assert result["issue_id"] is not None

        # Verify Issue record in PostgreSQL
        issue = db_session.query(Issue).filter(Issue.id == result["issue_id"]).first()
        assert issue is not None
        assert issue.project_id == project.id
        assert issue.api_config_id == api.id
        assert issue.status_code == 500
        assert issue.status == "OPEN"

    asyncio.run(_test())


def test_prometheus_metrics_endpoint(test_client):
    """Verify /metrics endpoint returns Prometheus formatted metrics."""
    response = test_client.get("/metrics")
    assert response.status_code == 200
    assert "api_cortex_requests_total" in response.text
    assert "api_cortex_response_time_seconds" in response.text
    assert "api_cortex_api_availability" in response.text
