import time
from typing import Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session
from app.models.api_config import ApiConfig
from app.models.monitoring_log import MonitoringLog
from app.models.issue import Issue
from app.models.schema_validation_issue import SchemaValidationIssue
from app.services.schema_validator import validate_response_schema
from app.services.prometheus_metrics import record_monitoring_metrics


async def execute_api_monitoring_check(api_config: ApiConfig, db: Session) -> Dict[str, Any]:
    """
    Asynchronously monitors a target API configuration, calculates latency,
    validates response schema drift, updates Prometheus metrics, and records
    logs and issues in PostgreSQL.
    """
    url = api_config.url
    method = api_config.method.upper()
    headers = api_config.headers or {}
    body = api_config.body
    expected_status = api_config.expected_status_code or 200
    expected_schema = api_config.expected_schema

    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    response_time_seconds: Optional[float] = None
    response_headers: Optional[Dict[str, Any]] = None
    response_body: Optional[Any] = None
    error_message: Optional[str] = None
    is_healthy = True
    issue_type: Optional[str] = None
    schema_results: Optional[Dict[str, Any]] = None

    # Measure exact request latency using high-resolution perf_counter
    start_time = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            request_kwargs = {
                "method": method,
                "url": url,
                "headers": headers
            }
            if body and method in ["POST", "PUT", "PATCH"]:
                request_kwargs["json"] = body

            response = await client.request(**request_kwargs)
            elapsed = time.perf_counter() - start_time
            response_time_seconds = elapsed
            response_time_ms = round(elapsed * 1000, 2)

            status_code = response.status_code
            response_headers = dict(response.headers)

            # Parse JSON body if present
            try:
                response_body = response.json()
            except Exception:
                response_body = response.text[:1000] if response.text else None

            # 1. Check Status Code Failure
            if status_code != expected_status:
                is_healthy = False
                issue_type = "HTTP_ERROR" if status_code >= 400 else "UNEXPECTED_STATUS"
                error_message = f"HTTP status code mismatch: expected {expected_status}, received {status_code}"

            # 2. Check Schema Validation & Drift if response is 2xx and schema present
            if is_healthy and expected_schema and response_body is not None:
                validation_res = validate_response_schema(response_body, expected_schema)
                schema_results = validation_res.model_dump()

                if validation_res.has_drift:
                    is_healthy = False
                    issue_type = "SCHEMA_DRIFT"
                    drift_types = set(d["drift_type"] for d in schema_results.get("drift_details", []))
                    if "MISSING_FIELD" in drift_types:
                        issue_type = "MISSING_FIELD"
                    elif "TYPE_MISMATCH" in drift_types:
                        issue_type = "TYPE_MISMATCH"
                    error_message = f"Schema drift detected: {validation_res.summary}"

            # 3. Check Latency
            if is_healthy and api_config.max_response_time_ms is not None:
                if response_time_ms > api_config.max_response_time_ms:
                    is_healthy = False
                    issue_type = "HIGH_LATENCY"
                    error_message = f"Response time exceeded threshold. Expected <= {api_config.max_response_time_ms} ms, received {response_time_ms} ms."

    except httpx.TimeoutException:
        elapsed = time.perf_counter() - start_time
        response_time_seconds = elapsed
        response_time_ms = round(elapsed * 1000, 2)
        is_healthy = False
        issue_type = "TIMEOUT"
        error_message = f"Request to '{url}' timed out after 15.0 seconds."

    except httpx.ConnectError as ce:
        elapsed = time.perf_counter() - start_time
        response_time_seconds = elapsed
        response_time_ms = round(elapsed * 1000, 2)
        is_healthy = False
        issue_type = "CONNECTION_FAILURE"
        error_message = f"Failed to connect to target URL '{url}': {str(ce)}"

    except Exception as e:
        elapsed = time.perf_counter() - start_time
        response_time_seconds = elapsed
        response_time_ms = round(elapsed * 1000, 2)
        is_healthy = False
        issue_type = "REQUEST_FAILURE"
        error_message = f"Execution error while monitoring API '{url}': {str(e)}"

    # 3. Update Prometheus Time-Series Metrics
    record_monitoring_metrics(
        project_id=api_config.project_id,
        api_id=api_config.id,
        api_name=api_config.name,
        method=method,
        status_code=status_code,
        response_time_seconds=response_time_seconds,
        is_healthy=is_healthy,
        issue_type=issue_type
    )

    # 4. Save Relational Monitoring Log in PostgreSQL
    log_entry = MonitoringLog(
        api_config_id=api_config.id,
        status_code=status_code,
        response_time_ms=response_time_ms,
        is_healthy=is_healthy,
        response_headers=response_headers,
        response_body=response_body if isinstance(response_body, (dict, list)) else {"raw": str(response_body)},
        error_message=error_message
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    created_issue = None

    # 5. Handle Issue Storage in PostgreSQL when problem detected
    if not is_healthy:
        # Check for existing open issue to prevent flooding duplicate records
        existing_open_issue = db.query(Issue).filter(
            Issue.api_config_id == api_config.id,
            Issue.status == "OPEN",
            Issue.issue_type == issue_type
        ).first()

        if not existing_open_issue:
            created_issue = Issue(
                project_id=api_config.project_id,
                api_config_id=api_config.id,
                monitoring_log_id=log_entry.id,
                issue_type=issue_type,
                status_code=status_code,
                error_details=error_message,
                schema_validation_results=schema_results,
                status="OPEN"
            )
            db.add(created_issue)
            db.commit()
            db.refresh(created_issue)

            # Store field-level schema drift details if present
            if schema_results and "drift_details" in schema_results:
                for drift in schema_results["drift_details"]:
                    drift_record = SchemaValidationIssue(
                        project_id=api_config.project_id,
                        api_config_id=api_config.id,
                        issue_id=created_issue.id,
                        drift_type=drift["drift_type"],
                        field_path=drift["field_path"],
                        expected_type=drift.get("expected_type"),
                        actual_type=drift.get("actual_type"),
                        description=drift["description"],
                        details=drift.get("details")
                    )
                    db.add(drift_record)
                db.commit()
        else:
            # Update timestamp and details of continuing issue
            existing_open_issue.status_code = status_code
            existing_open_issue.error_details = error_message
            existing_open_issue.schema_validation_results = schema_results
            db.commit()
            created_issue = existing_open_issue
    else:
        # If API is healthy, mark previous OPEN issues as RESOLVED
        open_issues = db.query(Issue).filter(
            Issue.api_config_id == api_config.id,
            Issue.status == "OPEN"
        ).all()
        for open_issue in open_issues:
            open_issue.status = "RESOLVED"
        if open_issues:
            db.commit()

    return {
        "project_id": api_config.project_id,
        "api_config_id": api_config.id,
        "api_name": api_config.name,
        "status_code": status_code,
        "response_time_ms": response_time_ms,
        "is_healthy": is_healthy,
        "issue_type": issue_type,
        "error_message": error_message,
        "schema_results": schema_results,
        "log_id": log_entry.id,
        "issue_id": created_issue.id if created_issue else None
    }
