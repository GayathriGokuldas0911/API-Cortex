import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import (
    User, Project, ApiConfig, EnvironmentConfig, OpenAPISpec,
    MonitoringLog, Issue, SchemaValidationIssue, AiDiagnosis
)

# Use SQLite in-memory database for isolated unit testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh in-memory database tables for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_user_project_hierarchy(db_session):
    """Verify User -> Project Workspace -> API Config model hierarchy."""
    # 1. Create User
    user = User(email="dev@apicortex.io", hashed_password="hashed_secret_pass", full_name="Lead Engineer")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.id is not None
    assert user.email == "dev@apicortex.io"

    # 2. Create Projects for User
    proj1 = Project(user_id=user.id, name="E-Commerce Services", description="Core e-commerce backend APIs")
    proj2 = Project(user_id=user.id, name="Payment Gateway", description="Financial transaction microservices")
    db_session.add_all([proj1, proj2])
    db_session.commit()

    assert len(user.projects) == 2
    assert user.projects[0].name == "E-Commerce Services"

    # 3. Create API Configs for Project 1
    api1 = ApiConfig(
        project_id=proj1.id,
        name="Get User Profile",
        url="https://api.example.com/v1/users/me",
        method="GET",
        expected_status_code=200,
        expected_schema={"type": "object", "properties": {"id": {"type": "integer"}, "name": {"type": "string"}}}
    )
    db_session.add(api1)
    db_session.commit()
    db_session.refresh(api1)

    assert api1.project_id == proj1.id
    assert len(proj1.api_configs) == 1
    assert proj1.api_configs[0].name == "Get User Profile"


def test_issue_and_ai_diagnosis_relationship(db_session):
    """Verify Issue -> SchemaValidationIssue & AiDiagnosis relationship and project tagging."""
    # Setup User, Project, API
    user = User(email="test@apicortex.io", hashed_password="hashed_pass")
    db_session.add(user)
    db_session.commit()

    proj = Project(user_id=user.id, name="Logistics API")
    db_session.add(proj)
    db_session.commit()

    api = ApiConfig(project_id=proj.id, name="Track Shipment", url="https://api.example.com/track")
    db_session.add(api)
    db_session.commit()

    log = MonitoringLog(api_config_id=api.id, status_code=500, response_time_ms=450.0, is_healthy=False, error_message="Internal Server Error")
    db_session.add(log)
    db_session.commit()

    # Create Issue
    issue = Issue(
        project_id=proj.id,
        api_config_id=api.id,
        monitoring_log_id=log.id,
        issue_type="SCHEMA_DRIFT",
        status_code=500,
        error_details="Expected integer for field 'shipment_id', received string",
        status="OPEN"
    )
    db_session.add(issue)
    db_session.commit()
    db_session.refresh(issue)

    # Create Schema Validation Detail
    drift_detail = SchemaValidationIssue(
        project_id=proj.id,
        api_config_id=api.id,
        issue_id=issue.id,
        drift_type="TYPE_MISMATCH",
        field_path="shipment_id",
        expected_type="integer",
        actual_type="string",
        description="Type mismatch: expected integer, got string"
    )
    db_session.add(drift_detail)

    # Create AI Diagnosis
    diagnosis = AiDiagnosis(
        project_id=proj.id,
        api_config_id=api.id,
        issue_id=issue.id,
        root_cause="Upstream backend service migrated shipment_id UUID string representation without updating OpenAPI specification.",
        explanation="Field type mismatch caused client deserialization error.",
        severity="HIGH",
        possible_impact="Tracking dashboard fails to render shipment status.",
        recommended_action="Update expected_schema or update upstream endpoint to return integer IDs."
    )
    db_session.add(diagnosis)
    db_session.commit()

    assert issue.ai_diagnosis is not None
    assert issue.ai_diagnosis.severity == "HIGH"
    assert issue.ai_diagnosis.project_id == proj.id
    assert len(issue.schema_validation_issues) == 1
    assert issue.schema_validation_issues[0].field_path == "shipment_id"
