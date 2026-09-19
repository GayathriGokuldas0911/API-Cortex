import json
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import (
    User, Project, ApiConfig, MonitoringLog, Issue, SchemaValidationIssue, AiDiagnosis
)
from app.services.gemini_service import (
    diagnose_issue,
    diagnose_issue_safe,
    build_diagnostic_payload,
    call_gemini_api,
    parse_gemini_response_text,
    sanitize_text,
    GeminiDiagnosisResponse,
    GeminiServiceError,
    GeminiAPIKeyMissingError,
    GeminiInvalidKeyError,
    GeminiQuotaExceededError,
    GeminiTimeoutError,
    GeminiMalformedResponseError,
    IssueNotFoundError,
    InvalidIssueStateError,
)

# In-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Provides a fresh isolated database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def create_mock_client(return_data: dict):
    """Helper to generate a mock google-genai Client returning specified JSON data."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps(return_data)
    mock_client.models.generate_content.return_value = mock_response
    return mock_client


# ==============================================================================
# 1. Missing and Invalid API Key Tests
# ==============================================================================
def test_missing_api_key_handling(db_session):
    """Verify missing or placeholder GEMINI_API_KEY is handled cleanly without crashing."""
    # Create an issue
    user = User(email="test@apicortex.io", hashed_password="pw", full_name="Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Test Project")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="Test API", url="https://api.test/v1", method="GET")
    db_session.add(api)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="HTTP_ERROR",
        status_code=500,
        error_details="Internal Server Error"
    )
    db_session.add(issue)
    db_session.commit()

    # Pass empty key
    with patch("app.services.gemini_service.settings.GEMINI_API_KEY", ""):
        with pytest.raises(GeminiAPIKeyMissingError) as exc_info:
            diagnose_issue(db_session, issue.id, api_key="")
        assert "not configured" in str(exc_info.value)

        # diagnose_issue_safe should not crash
        safe_result = diagnose_issue_safe(db_session, issue.id, api_key="")
        assert safe_result["success"] is False
        assert safe_result["error_type"] == "GeminiAPIKeyMissingError"


def test_api_key_redaction_and_sanitization():
    """Verify that actual API keys are never exposed in error text or logs."""
    fake_key = "AIzaSyB_1234567890abcdefghijklmnopqrstuv"
    raw_error = f"Request failed with key: {fake_key} due to network timeout"
    sanitized = sanitize_text(raw_error, [fake_key])
    assert fake_key not in sanitized
    assert "***REDACTED_API_KEY***" in sanitized


# ==============================================================================
# 2. HTTP Failure Diagnosis Test
# ==============================================================================
def test_http_failure_diagnosis(db_session):
    """Verify diagnosis generation for 500 HTTP Error, including RCA, severity, and remediation."""
    user = User(email="http_test@cortex.io", hashed_password="pw", full_name="HTTP Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Checkout Service")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(
        project_id=project.id,
        name="Process Payment",
        url="https://checkout.example.com/api/charge",
        method="POST",
        expected_status_code=200
    )
    db_session.add(api)
    db_session.commit()

    log = MonitoringLog(
        api_config_id=api.id,
        status_code=500,
        response_time_ms=850.0,
        is_healthy=False,
        response_body={"error": "Database deadlock detected in payment table"},
        error_message="HTTP status code mismatch: expected 200, received 500"
    )
    db_session.add(log)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        monitoring_log_id=log.id,
        issue_type="HTTP_ERROR",
        status_code=500,
        error_details="HTTP status code mismatch: expected 200, received 500",
        status="OPEN"
    )
    db_session.add(issue)
    db_session.commit()

    mock_gemini_response = {
        "root_cause": "Database deadlock and connection pool exhaustion in payment gateway transactions.",
        "explanation": "Target service returned 500 Internal Server Error due to an unhandled deadlock in PostgreSQL transactions.",
        "severity": "CRITICAL",
        "possible_impact": "Downstream users cannot complete purchases; high risk of revenue loss.",
        "recommended_action": "Implement optimistic locking, add connection pool retries, and scale database read replicas."
    }
    mock_client = create_mock_client(mock_gemini_response)

    diagnosis = diagnose_issue(
        db=db_session,
        issue_id=issue.id,
        api_key="mock_test_key_12345",
        client_override=mock_client
    )

    assert diagnosis is not None
    assert diagnosis.issue_id == issue.id
    assert diagnosis.api_config_id == api.id
    assert diagnosis.project_id == project.id
    assert diagnosis.severity == "CRITICAL"
    assert "deadlock" in diagnosis.root_cause.lower()
    assert "purchases" in diagnosis.possible_impact.lower()
    assert "optimistic locking" in diagnosis.recommended_action.lower()

    # Verify Issue status updated in DB
    db_session.refresh(issue)
    assert issue.status == "DIAGNOSED"


# ==============================================================================
# 3. Schema Drift Diagnosis Test
# ==============================================================================
def test_schema_drift_diagnosis(db_session):
    """Verify diagnosis generation for missing fields and structural schema drift."""
    user = User(email="schema@cortex.io", hashed_password="pw", full_name="Schema Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="User Portal")
    db_session.add(project)
    db_session.commit()

    expected_schema = {
        "type": "object",
        "required": ["id", "username", "account_tier"],
        "properties": {
            "id": {"type": "integer"},
            "username": {"type": "string"},
            "account_tier": {"type": "string"}
        }
    }
    api = ApiConfig(
        project_id=project.id,
        name="Get User Profile",
        url="https://api.example.com/users/42",
        method="GET",
        expected_schema=expected_schema
    )
    db_session.add(api)
    db_session.commit()

    drift_results = {
        "is_valid": False,
        "has_drift": True,
        "summary": "1 missing required fields",
        "drift_details": [
            {
                "drift_type": "MISSING_FIELD",
                "field_path": "account_tier",
                "expected_type": "string",
                "actual_type": "null",
                "description": "Required field 'account_tier' was missing from payload."
            }
        ]
    }

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="SCHEMA_DRIFT",
        status_code=200,
        error_details="Schema drift detected: 1 missing required fields",
        schema_validation_results=drift_results,
        status="OPEN"
    )
    db_session.add(issue)
    db_session.commit()

    mock_gemini_response = {
        "root_cause": "Field 'account_tier' was dropped in upstream microservice serialization logic.",
        "explanation": "Endpoint returned 200 OK but omitted mandatory field 'account_tier' expected by client contracts.",
        "severity": "HIGH",
        "possible_impact": "Clients relying on 'account_tier' for UI access control may crash or default to free tier.",
        "recommended_action": "Update backend serializer to include 'account_tier' or provide default fallback in API contract."
    }
    mock_client = create_mock_client(mock_gemini_response)

    diagnosis = diagnose_issue(
        db=db_session,
        issue_id=issue.id,
        api_key="mock_test_key_12345",
        client_override=mock_client
    )

    assert diagnosis.severity == "HIGH"
    assert "account_tier" in diagnosis.root_cause
    assert diagnosis.api_config_id == api.id
    assert diagnosis.project_id == project.id

    db_session.refresh(issue)
    assert issue.status == "DIAGNOSED"


# ==============================================================================
# 4. Datatype Mismatch & Validation Error Test
# ==============================================================================
def test_datatype_mismatch_validation_diagnosis(db_session):
    """Verify diagnosis generation for datatype mismatch (e.g. string instead of integer)."""
    user = User(email="type@cortex.io", hashed_password="pw", full_name="Type Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Analytics Hub")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(
        project_id=project.id,
        name="Get Metrics Counter",
        url="https://api.example.com/counters",
        method="GET",
        expected_schema={"type": "object", "properties": {"count": {"type": "integer"}}}
    )
    db_session.add(api)
    db_session.commit()

    drift_results = {
        "is_valid": False,
        "has_drift": True,
        "summary": "1 type mismatch detected",
        "drift_details": [
            {
                "drift_type": "TYPE_MISMATCH",
                "field_path": "count",
                "expected_type": "integer",
                "actual_type": "string",
                "description": "Field 'count' type mismatch: expected integer, received string"
            }
        ]
    }

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="TYPE_MISMATCH",
        status_code=200,
        error_details="Type mismatch: expected integer, got string",
        schema_validation_results=drift_results
    )
    db_session.add(issue)
    db_session.commit()

    mock_gemini_response = {
        "root_cause": "Number value formatted as string ('123') in JSON serializer output.",
        "explanation": "Type mismatch violates expected integer schema, risking deserialization errors.",
        "severity": "MEDIUM",
        "possible_impact": "Strict clients with type validation will reject payload.",
        "recommended_action": "Cast 'count' to integer in backend controller before rendering JSON."
    }
    mock_client = create_mock_client(mock_gemini_response)

    diagnosis = diagnose_issue(
        db=db_session,
        issue_id=issue.id,
        api_key="mock_key_123",
        client_override=mock_client
    )

    assert diagnosis.severity == "MEDIUM"
    assert "serializer" in diagnosis.root_cause.lower()
    assert "cast 'count' to integer" in diagnosis.recommended_action.lower()


# ==============================================================================
# 5. Prometheus Metrics Exclusion Verification
# ==============================================================================
def test_prometheus_metrics_not_sent_to_gemini(db_session):
    """Verify that Prometheus time-series metrics are strictly excluded from diagnostic payload."""
    user = User(email="metrics@cortex.io", hashed_password="pw", full_name="Metrics Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Test Project")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="API With Metrics", url="https://api.test", method="GET")
    db_session.add(api)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="HTTP_ERROR",
        status_code=404,
        error_details="Not Found"
    )
    db_session.add(issue)
    db_session.commit()

    payload = build_diagnostic_payload(issue)

    # Ensure no prometheus keys or counters exist
    payload_str = json.dumps(payload).lower()
    assert "prometheus" not in payload_str
    assert "api_requests_total" not in payload_str
    assert "api_response_time_seconds" not in payload_str
    assert "api_errors_total" not in payload_str
    assert "histogram" not in payload_str


# ==============================================================================
# 6. Diagnosis Storage Update Test
# ==============================================================================
def test_diagnosis_update_existing_record(db_session):
    """Verify that re-diagnosing an issue updates the existing AiDiagnosis record."""
    user = User(email="dup@cortex.io", hashed_password="pw", full_name="Dup Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Project Dup")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="API Dup", url="https://api.dup", method="GET")
    db_session.add(api)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="TIMEOUT",
        error_details="Timed out"
    )
    db_session.add(issue)
    db_session.commit()

    mock_res_1 = {
        "root_cause": "First RCA",
        "explanation": "First explanation",
        "severity": "HIGH",
        "possible_impact": "First impact",
        "recommended_action": "First action"
    }
    mock_res_2 = {
        "root_cause": "Second RCA updated",
        "explanation": "Second explanation updated",
        "severity": "CRITICAL",
        "possible_impact": "Second impact updated",
        "recommended_action": "Second action updated"
    }

    # First diagnosis
    diag_1 = diagnose_issue(db_session, issue.id, api_key="key", client_override=create_mock_client(mock_res_1))
    diag_1_id = diag_1.id

    # Second diagnosis on same issue
    diag_2 = diagnose_issue(db_session, issue.id, api_key="key", client_override=create_mock_client(mock_res_2))

    assert diag_2.id == diag_1_id
    assert diag_2.root_cause == "Second RCA updated"
    assert diag_2.severity == "CRITICAL"

    # Count diagnoses for this issue
    count = db_session.query(AiDiagnosis).filter(AiDiagnosis.issue_id == issue.id).count()
    assert count == 1


# ==============================================================================
# 7. Invalid Gemini Response Handling
# ==============================================================================
def test_invalid_gemini_response_handling(db_session):
    """Verify graceful handling when Gemini returns malformed or non-JSON text."""
    user = User(email="malformed@cortex.io", hashed_password="pw", full_name="Malformed Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Project Malformed")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="API Malformed", url="https://api.malformed", method="GET")
    db_session.add(api)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="HTTP_ERROR",
        error_details="Bad Gateway"
    )
    db_session.add(issue)
    db_session.commit()

    # Non-JSON response
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "I cannot analyze this request because I am an AI language model."
    mock_client.models.generate_content.return_value = mock_response

    with pytest.raises(GeminiMalformedResponseError):
        diagnose_issue(db_session, issue.id, api_key="key", client_override=mock_client)

    # diagnose_issue_safe should catch it and return failure dict
    safe_res = diagnose_issue_safe(db_session, issue.id, api_key="key", client_override=mock_client)
    assert safe_res["success"] is False
    assert safe_res["error_type"] == "GeminiMalformedResponseError"


# ==============================================================================
# 8. Timeout & API Error Handling
# ==============================================================================
def test_gemini_timeout_handling(db_session):
    """Verify graceful handling when Gemini API request times out."""
    user = User(email="timeout@cortex.io", hashed_password="pw", full_name="Timeout Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Project Timeout")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="API Timeout", url="https://api.timeout", method="GET")
    db_session.add(api)
    db_session.commit()

    issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="TIMEOUT",
        error_details="Gateway Timeout"
    )
    db_session.add(issue)
    db_session.commit()

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = TimeoutError("Socket connection timed out")

    with pytest.raises(GeminiTimeoutError):
        diagnose_issue(db_session, issue.id, api_key="key", client_override=mock_client)

    safe_res = diagnose_issue_safe(db_session, issue.id, api_key="key", client_override=mock_client)
    assert safe_res["success"] is False
    assert safe_res["error_type"] == "GeminiTimeoutError"


# ==============================================================================
# 9. Healthy / Resolved Issue Rejection
# ==============================================================================
def test_healthy_and_resolved_issues_rejected(db_session):
    """Verify that resolved or healthy states cannot be submitted for AI diagnosis."""
    user = User(email="healthy@cortex.io", hashed_password="pw", full_name="Healthy Tester")
    db_session.add(user)
    db_session.commit()

    project = Project(user_id=user.id, name="Project Healthy")
    db_session.add(project)
    db_session.commit()

    api = ApiConfig(project_id=project.id, name="API Healthy", url="https://api.healthy", method="GET")
    db_session.add(api)
    db_session.commit()

    # Resolved issue
    resolved_issue = Issue(
        project_id=project.id,
        api_config_id=api.id,
        issue_type="HTTP_ERROR",
        error_details="Fixed error",
        status="RESOLVED"
    )
    db_session.add(resolved_issue)
    db_session.commit()

    with pytest.raises(InvalidIssueStateError) as exc_info:
        diagnose_issue(db_session, resolved_issue.id, api_key="key")
    assert "RESOLVED" in str(exc_info.value)


# ==============================================================================
# 10. Multi-Project / Multi-API Isolation
# ==============================================================================
def test_multiple_apis_projects_isolation(db_session):
    """Verify that diagnosis records across distinct projects and APIs maintain strict isolation."""
    user = User(email="isolation@cortex.io", hashed_password="pw", full_name="Isolation Tester")
    db_session.add(user)
    db_session.commit()

    # Project A
    proj_a = Project(user_id=user.id, name="Project Alpha")
    # Project B
    proj_b = Project(user_id=user.id, name="Project Beta")
    db_session.add_all([proj_a, proj_b])
    db_session.commit()

    api_a = ApiConfig(project_id=proj_a.id, name="API Alpha", url="https://alpha.io", method="GET")
    api_b = ApiConfig(project_id=proj_b.id, name="API Beta", url="https://beta.io", method="POST")
    db_session.add_all([api_a, api_b])
    db_session.commit()

    issue_a = Issue(project_id=proj_a.id, api_config_id=api_a.id, issue_type="HTTP_ERROR", error_details="Alpha 500")
    issue_b = Issue(project_id=proj_b.id, api_config_id=api_b.id, issue_type="SCHEMA_DRIFT", error_details="Beta Drift")
    db_session.add_all([issue_a, issue_b])
    db_session.commit()

    mock_resp_a = {
        "root_cause": "Alpha Root Cause",
        "explanation": "Alpha explanation",
        "severity": "CRITICAL",
        "possible_impact": "Alpha impact",
        "recommended_action": "Alpha action"
    }
    mock_resp_b = {
        "root_cause": "Beta Root Cause",
        "explanation": "Beta explanation",
        "severity": "MEDIUM",
        "possible_impact": "Beta impact",
        "recommended_action": "Beta action"
    }

    diag_a = diagnose_issue(db_session, issue_a.id, api_key="key", client_override=create_mock_client(mock_resp_a))
    diag_b = diagnose_issue(db_session, issue_b.id, api_key="key", client_override=create_mock_client(mock_resp_b))

    # Verify Project Alpha isolation
    assert diag_a.project_id == proj_a.id
    assert diag_a.api_config_id == api_a.id
    assert diag_a.issue_id == issue_a.id
    assert diag_a.severity == "CRITICAL"

    # Verify Project Beta isolation
    assert diag_b.project_id == proj_b.id
    assert diag_b.api_config_id == api_b.id
    assert diag_b.issue_id == issue_b.id
    assert diag_b.severity == "MEDIUM"

    # Query by project
    project_a_diagnoses = db_session.query(AiDiagnosis).filter(AiDiagnosis.project_id == proj_a.id).all()
    project_b_diagnoses = db_session.query(AiDiagnosis).filter(AiDiagnosis.project_id == proj_b.id).all()

    assert len(project_a_diagnoses) == 1
    assert len(project_b_diagnoses) == 1
    assert project_a_diagnoses[0].id == diag_a.id
    assert project_b_diagnoses[0].id == diag_b.id
