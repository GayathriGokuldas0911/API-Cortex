import json
from unittest.mock import patch, MagicMock
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import (
    User, Project, ApiConfig, MonitoringLog, Issue, SchemaValidationIssue, AiDiagnosis
)
from app.schemas.dashboard import DashboardSummaryRead
from app.schemas.issue import IssueRead
from app.schemas.ai_diagnosis import AiDiagnosisRead
from app.core.security import create_access_token, get_password_hash
from app.services.gemini_service import (
    GeminiDiagnosisResponse,
    GeminiTimeoutError,
    GeminiQuotaExceededError,
    GeminiInvalidKeyError,
    GeminiMalformedResponseError
)
from app.main import app

from sqlalchemy.pool import StaticPool

# Isolated In-Memory SQLite Engine with StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh database tables for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient with overridden get_db dependency."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_test_user(db, email: str, password: str = "SecretPass123!"):
    """Helper to create a user and generate a valid JWT Bearer token."""
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=f"User {email.split('@')[0]}",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        data={"sub": user.email, "user_id": user.id},
        expires_delta=timedelta(hours=2)
    )
    return user, token


# ==============================================================================
# 1. Successful Issue Diagnosis Endpoint
# ==============================================================================
def test_successful_issue_diagnosis_endpoint(client, db_session):
    """Test POST /api/v1/issues/{id}/diagnose triggers Gemini and persists structured diagnosis."""
    user, token = create_test_user(db_session, "doctor@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(user_id=user.id, name="Billing System")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(
        project_id=project.id,
        name="Invoice API",
        url="https://billing.cortex.io/invoices",
        method="GET",
        expected_status_code=200
    )
    db_session.add(api)
    db_session.commit()

    log = MonitoringLog(
        api_config_id=api.id,
        status_code=500,
        response_time_ms=920.0,
        is_healthy=False,
        error_message="500 Internal Server Error"
    )
    db_session.add(log)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        monitoring_log_id=log.id,
        issue_type="HTTP_ERROR",
        status_code=500,
        error_details="500 Internal Server Error",
        status="OPEN"
    )
    db_session.add(issue)
    db_session.commit()

    mock_gemini_res = GeminiDiagnosisResponse(
        root_cause="PostgreSQL database connection pool timeout in invoice microservice.",
        explanation="The invoice service was unable to acquire an active database connection within 5 seconds.",
        severity="CRITICAL",
        possible_impact="Billing requests will fail, impacting user payment settlement.",
        recommended_action="Increase connection pool max_size in service config and enable keep-alive pings."
    )

    with patch("app.services.gemini_service.call_gemini_api", return_value=mock_gemini_res):
        response = client.post(f"/api/v1/issues/{issue.id}/diagnose", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["issue_id"] == issue.id
    assert data["project_id"] == project.id
    assert data["api_config_id"] == api.id
    assert data["severity"] == "CRITICAL"
    assert "connection pool" in data["root_cause"].lower()
    assert "increase connection pool" in data["recommended_action"].lower()

    # Verify Issue status updated in DB
    db_session.refresh(issue)
    assert issue.status == "DIAGNOSED"

    # Verify AiDiagnosis saved in DB
    diag_db = db_session.query(AiDiagnosis).filter(AiDiagnosis.issue_id == issue.id).first()
    assert diag_db is not None
    assert diag_db.severity == "CRITICAL"


# ==============================================================================
# 2. Issue Not Found Handling
# ==============================================================================
def test_issue_not_found_returns_404(client, db_session):
    """Test 404 response when querying or diagnosing non-existent issue IDs."""
    user, token = create_test_user(db_session, "user_404@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    # GET non-existent
    get_res = client.get("/api/v1/issues/999999", headers=headers)
    assert get_res.status_code == 404
    assert "not found" in get_res.json()["detail"].lower()

    # POST diagnose non-existent
    post_res = client.post("/api/v1/issues/999999/diagnose", headers=headers)
    assert post_res.status_code == 404
    assert "not found" in post_res.json()["detail"].lower()


# ==============================================================================
# 3. Unauthorized Issue Access Control (403 Forbidden)
# ==============================================================================
def test_unauthorized_issue_access_forbidden(client, db_session):
    """Test that User B cannot access or diagnose User A's issues (403 Forbidden)."""
    user_a, token_a = create_test_user(db_session, "alice@cortex.io")
    user_b, token_b = create_test_user(db_session, "bob@cortex.io")

    project_a = Project(user_id=user_a.id, name="Alice Project")
    db_session.add(project_a)
    db_session.commit()

    api_a = ApiConfig(project_id=project_a.id, name="Alice API", url="https://alice.io", method="GET")
    db_session.add(api_a)
    db_session.commit()

    issue_a = Issue(
        project_id=project_a.id,
        api_config_id=api_a.id,
        issue_type="TIMEOUT",
        error_details="Timeout error",
        status="OPEN"
    )
    db_session.add(issue_a)
    db_session.commit()

    # Bob attempts to GET Alice's issue
    bob_headers = {"Authorization": f"Bearer {token_b}"}
    get_res = client.get(f"/api/v1/issues/{issue_a.id}", headers=bob_headers)
    assert get_res.status_code == 403
    assert "authorization" in get_res.json()["detail"].lower()

    # Bob attempts to POST diagnose Alice's issue
    post_res = client.post(f"/api/v1/issues/{issue_a.id}/diagnose", headers=bob_headers)
    assert post_res.status_code == 403
    assert "authorization" in post_res.json()["detail"].lower()


# ==============================================================================
# 4. Successful Issue Retrieval & Enrichment
# ==============================================================================
def test_successful_issue_retrieval_and_enrichment(client, db_session):
    """Test GET /api/v1/issues/ returns enriched issue records with API and Project metadata."""
    user, token = create_test_user(db_session, "retriever@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(user_id=user.id, name="Storefront")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="Search API", url="https://store.io/search", method="POST")
    db_session.add(api)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="SCHEMA_DRIFT",
        status_code=200,
        error_details="Missing price field",
        schema_validation_results={"summary": "1 missing field"},
        status="OPEN"
    )
    db_session.add(issue)
    db_session.commit()

    res = client.get("/api/v1/issues/", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == issue.id
    assert data[0]["api_name"] == "Search API"
    assert data[0]["api_method"] == "POST"
    assert data[0]["project_name"] == "Storefront"
    assert data[0]["issue_type"] == "SCHEMA_DRIFT"


# ==============================================================================
# 5. Cross-User Issue Isolation
# ==============================================================================
def test_cross_user_issue_isolation(client, db_session):
    """Test that listing issues strictly returns only issues belonging to the calling user."""
    user_1, token_1 = create_test_user(db_session, "tenant1@cortex.io")
    user_2, token_2 = create_test_user(db_session, "tenant2@cortex.io")

    # User 1 resource
    proj_1 = Project(user_id=user_1.id, name="Project 1")
    db_session.add(proj_1)
    db_session.commit()
    api_1 = ApiConfig(project_id=proj_1.id, name="API 1", url="https://p1.io", method="GET")
    db_session.add(api_1)
    db_session.commit()
    issue_1 = Issue(project_id=proj_1.id, api_config_id=api_1.id, issue_type="HTTP_ERROR", error_details="P1 Err")
    db_session.add(issue_1)

    # User 2 resource
    proj_2 = Project(user_id=user_2.id, name="Project 2")
    db_session.add(proj_2)
    db_session.commit()
    api_2 = ApiConfig(project_id=proj_2.id, name="API 2", url="https://p2.io", method="GET")
    db_session.add(api_2)
    db_session.commit()
    issue_2 = Issue(project_id=proj_2.id, api_config_id=api_2.id, issue_type="TIMEOUT", error_details="P2 Timeout")
    db_session.add(issue_2)
    db_session.commit()

    # User 1 queries issues
    res_1 = client.get("/api/v1/issues/", headers={"Authorization": f"Bearer {token_1}"})
    assert res_1.status_code == 200
    ids_1 = [i["id"] for i in res_1.json()]
    assert issue_1.id in ids_1
    assert issue_2.id not in ids_1

    # User 2 queries issues
    res_2 = client.get("/api/v1/issues/", headers={"Authorization": f"Bearer {token_2}"})
    assert res_2.status_code == 200
    ids_2 = [i["id"] for i in res_2.json()]
    assert issue_2.id in ids_2
    assert issue_1.id not in ids_2


# ==============================================================================
# 6. Successful Dashboard Summary Endpoint
# ==============================================================================
def test_successful_dashboard_summary(client, db_session):
    """Test GET /api/v1/dashboard/summary calculates consolidated health metrics."""
    user, token = create_test_user(db_session, "dash@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(user_id=user.id, name="Production Microservices")
    db_session.add(project)
    db_session.commit()

    # API 1: Healthy
    api_healthy = ApiConfig(project_id=project.id, name="Auth API", url="https://auth.io", method="GET")
    # API 2: Unhealthy
    api_unhealthy = ApiConfig(project_id=project.id, name="Payment API", url="https://pay.io", method="POST")
    db_session.add_all([api_healthy, api_unhealthy])
    db_session.commit()

    # Logs for API 1 (3 requests, all healthy, avg 100ms)
    db_session.add_all([
        MonitoringLog(api_config_id=api_healthy.id, status_code=200, response_time_ms=90.0, is_healthy=True),
        MonitoringLog(api_config_id=api_healthy.id, status_code=200, response_time_ms=110.0, is_healthy=True),
        MonitoringLog(api_config_id=api_healthy.id, status_code=200, response_time_ms=100.0, is_healthy=True)
    ])
    # Logs for API 2 (1 request, failed 500, 300ms)
    db_session.add(
        MonitoringLog(api_config_id=api_unhealthy.id, status_code=500, response_time_ms=300.0, is_healthy=False)
    )
    # Open issue on API 2
    db_session.add(
        Issue(project_id=project.id, api_config_id=api_unhealthy.id, issue_type="HTTP_ERROR", status="OPEN", error_details="500")
    )
    db_session.commit()

    res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert res.status_code == 200
    summary = res.json()

    assert summary["total_projects"] == 1
    assert summary["total_apis"] == 2
    assert summary["healthy_apis"] == 1
    assert summary["unhealthy_apis"] == 1
    assert summary["total_requests"] == 4
    assert summary["total_errors"] == 1
    # Availability: (4 - 1)/4 = 75.0%
    assert summary["availability_percentage"] == 75.0
    # Avg latency: (90+110+100+300)/4 = 150.0ms
    assert summary["avg_response_time_ms"] == 150.0
    assert summary["unresolved_issues"] == 1
    assert len(summary["api_health_list"]) == 2


# ==============================================================================
# 7. Project Isolation in Dashboard Summary
# ==============================================================================
def test_project_isolation_in_dashboard_summary(client, db_session):
    """Test filtering dashboard summary by project_id and rejecting access to foreign projects."""
    user_a, token_a = create_test_user(db_session, "user_a@cortex.io")
    user_b, token_b = create_test_user(db_session, "user_b@cortex.io")

    proj_a = Project(user_id=user_a.id, name="Project A")
    proj_b = Project(user_id=user_b.id, name="Project B")
    db_session.add_all([proj_a, proj_b])
    db_session.commit()

    api_a = ApiConfig(project_id=proj_a.id, name="API A", url="https://a.io", method="GET")
    db_session.add(api_a)
    db_session.commit()

    # User A requests their own project summary
    res_a = client.get(f"/api/v1/dashboard/summary?project_id={proj_a.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    assert res_a.json()["total_apis"] == 1
    assert res_a.json()["project_id"] == proj_a.id

    # User B attempts to access User A's project summary (403 Forbidden)
    res_forbidden = client.get(f"/api/v1/dashboard/summary?project_id={proj_a.id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res_forbidden.status_code == 403


# ==============================================================================
# 8. Empty Project with No APIs Dashboard Summary
# ==============================================================================
def test_empty_project_dashboard_summary(client, db_session):
    """Test that a brand new empty project returns safe zeroed metrics without division errors."""
    user, token = create_test_user(db_session, "empty@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(user_id=user.id, name="Empty Workspace")
    db_session.add(project)
    db_session.commit()

    res = client.get(f"/api/v1/dashboard/summary?project_id={project.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_apis"] == 0
    assert data["healthy_apis"] == 0
    assert data["unhealthy_apis"] == 0
    assert data["total_requests"] == 0
    assert data["total_errors"] == 0
    assert data["availability_percentage"] == 100.0
    assert data["avg_response_time_ms"] == 0.0
    assert data["recent_issues"] == []
    assert data["api_health_list"] == []


# ==============================================================================
# 9. Gemini Service Failure Handling (HTTP 504, 429, 502, 400)
# ==============================================================================
def test_gemini_service_failure_handling(client, db_session):
    """Test error mapping when Gemini service encounters timeout, quota limit, or invalid state."""
    user, token = create_test_user(db_session, "gemini_err@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(user_id=user.id, name="Err Project")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="Err API", url="https://err.io", method="GET")
    db_session.add(api)
    db_session.commit()

    issue = Issue(project_id=project.id, api_config_id=api.id, issue_type="HTTP_ERROR", error_details="Err", status="OPEN")
    db_session.add(issue)
    db_session.commit()

    # 1. Timeout -> 504
    with patch("app.services.gemini_service.call_gemini_api", side_effect=GeminiTimeoutError("Timeout")):
        res_timeout = client.post(f"/api/v1/issues/{issue.id}/diagnose", headers=headers)
        assert res_timeout.status_code == 504
        assert "timed out" in res_timeout.json()["detail"].lower()

    # 2. Quota exceeded -> 429
    with patch("app.services.gemini_service.call_gemini_api", side_effect=GeminiQuotaExceededError("Rate limit")):
        res_quota = client.post(f"/api/v1/issues/{issue.id}/diagnose", headers=headers)
        assert res_quota.status_code == 429
        assert "quota" in res_quota.json()["detail"].lower()

    # 3. Invalid key / service error -> 502
    with patch("app.services.gemini_service.call_gemini_api", side_effect=GeminiInvalidKeyError("Bad Key")):
        res_bad_key = client.post(f"/api/v1/issues/{issue.id}/diagnose", headers=headers)
        assert res_bad_key.status_code == 502

    # 4. Attempt to diagnose a RESOLVED issue -> 400 Bad Request
    issue.status = "RESOLVED"
    db_session.commit()
    res_resolved = client.post(f"/api/v1/issues/{issue.id}/diagnose", headers=headers)
    assert res_resolved.status_code == 400
    assert "resolved" in res_resolved.json()["detail"].lower()


# ==============================================================================
# 10. Database Failure Handling
# ==============================================================================
def test_database_failure_handling(client, db_session):
    """Test unexpected database exception is caught and returned cleanly without crash."""
    user, token = create_test_user(db_session, "db_fail@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(user_id=user.id, name="DB Fail Project")
    db_session.add(project)
    db_session.commit()

    # Patch query execution to simulate DB connection drop
    with patch.object(db_session, "query", side_effect=OperationalError("Connection lost", {}, None)):
        res = client.get("/api/v1/issues/", headers=headers)
        # Should return 500 error without exposing stack trace
        assert res.status_code == 500 or res.status_code == 502


# ==============================================================================
# 11. Authentication Failure
# ==============================================================================
def test_authentication_failure(client):
    """Test unauthenticated or invalid token requests receive HTTP 401 Unauthorized."""
    # 1. No token
    res_no_token = client.get("/api/v1/issues/")
    assert res_no_token.status_code == 401
    assert "authentication required" in res_no_token.json()["detail"].lower()

    # 2. Invalid token
    res_invalid_token = client.get("/api/v1/issues/", headers={"Authorization": "Bearer not_a_real_jwt_token"})
    assert res_invalid_token.status_code == 401
    assert "could not validate credentials" in res_invalid_token.json()["detail"].lower()

    # 3. Malformed header
    res_bad_header = client.get("/api/v1/dashboard/summary", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert res_bad_header.status_code == 401


# ==============================================================================
# 12. Correct HTTP Status Codes Verification
# ==============================================================================
def test_correct_http_status_codes_across_endpoints(client, db_session):
    """Verify HTTP status codes match standards: 200, 201, 400, 401, 403, 404."""
    # 201 Created on user registration
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "new_user@cortex.io",
        "password": "Password123!",
        "full_name": "New User"
    })
    assert reg_res.status_code == 201

    # 400 Bad Request on duplicate registration
    dup_res = client.post("/api/v1/auth/register", json={
        "email": "new_user@cortex.io",
        "password": "Password123!"
    })
    assert dup_res.status_code == 400

    # 200 OK on login
    login_res = client.post("/api/v1/auth/login", json={
        "email": "new_user@cortex.io",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 201 Created on Project creation
    proj_res = client.post(
        "/api/v1/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "New Project", "description": "Desc"}
    )
    assert proj_res.status_code == 201

    # 404 on non-existent project
    proj_404 = client.get("/api/v1/projects/9999", headers={"Authorization": f"Bearer {token}"})
    assert proj_404.status_code == 404


# ==============================================================================
# 13. Response Schema Validation & Secret Protection
# ==============================================================================
def test_response_schema_validation_and_secrets_protected(client, db_session):
    """Verify response payloads match Pydantic schemas and NEVER expose passwords or keys."""
    user, token = create_test_user(db_session, "security@cortex.io")
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(user_id=user.id, name="Security Test")
    db_session.add(project)
    db_session.commit()

    # 1. User profile endpoint
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert "password" not in me_data
    assert "hashed_password" not in me_data
    assert me_data["email"] == "security@cortex.io"

    # 2. Dashboard summary schema validation
    dash_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    DashboardSummaryRead.model_validate(dash_data)

    # Ensure no internal keys exist in JSON strings
    dash_str = json.dumps(dash_data).lower()
    assert "secret_key" not in dash_str
    assert "gemini_api_key" not in dash_str
    assert "password" not in dash_str
