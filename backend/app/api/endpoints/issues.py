from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.issue import Issue
from app.schemas.issue import IssueRead
from app.schemas.ai_diagnosis import AiDiagnosisRead
from app.api.deps import get_current_user, verify_issue_access, verify_project_access
from app.services.gemini_service import (
    diagnose_issue,
    GeminiServiceError,
    GeminiAPIKeyMissingError,
    GeminiInvalidKeyError,
    GeminiQuotaExceededError,
    GeminiTimeoutError,
    GeminiNetworkError,
    GeminiMalformedResponseError,
    InvalidIssueStateError,
    IssueNotFoundError,
    sanitize_text
)

router = APIRouter(prefix="/issues", tags=["Detected Issues & AI Diagnosis"])


def enrich_issue_read(issue: Issue) -> IssueRead:
    """Enriches an Issue ORM instance into an IssueRead schema with API and Project metadata."""
    schema_val_issues = []
    if issue.schema_validation_issues:
        schema_val_issues = issue.schema_validation_issues

    diagnosis_read = None
    if issue.ai_diagnosis:
        diagnosis_read = AiDiagnosisRead.model_validate(issue.ai_diagnosis)

    return IssueRead(
        id=issue.id,
        project_id=issue.project_id,
        api_config_id=issue.api_config_id,
        monitoring_log_id=issue.monitoring_log_id,
        issue_type=issue.issue_type,
        status_code=issue.status_code,
        error_details=issue.error_details,
        schema_validation_results=issue.schema_validation_results,
        status=issue.status,
        created_at=issue.created_at,
        api_name=issue.api_config.name if issue.api_config else None,
        api_url=issue.api_config.url if issue.api_config else None,
        api_method=issue.api_config.method if issue.api_config else None,
        project_name=issue.project.name if issue.project else None,
        expected_schema=issue.api_config.expected_schema if issue.api_config else None,
        response_body=issue.monitoring_log.response_body if issue.monitoring_log else None,
        schema_validation_issues=schema_val_issues,
        ai_diagnosis=diagnosis_read
    )


@router.get("/", response_model=List[IssueRead])
def list_issues(
    project_id: Optional[int] = Query(None, description="Filter issues by Project Workspace ID"),
    api_config_id: Optional[int] = Query(None, description="Filter issues by API Config ID"),
    status: Optional[str] = Query(None, description="Filter issues by status ('OPEN', 'DIAGNOSED', 'RESOLVED')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists detected monitoring issues and schema drift logs accessible to the authenticated user.
    Enforces project-level user access control.
    """
    # 1. Determine user's accessible projects
    if project_id is not None:
        # Verify access to the requested project
        verify_project_access(project_id, current_user, db)
        target_project_ids = [project_id]
    else:
        user_projects = db.query(Project.id).filter(Project.user_id == current_user.id).all()
        target_project_ids = [p[0] for p in user_projects]

    if not target_project_ids:
        return []

    # 2. Build filtered query
    query = db.query(Issue).filter(Issue.project_id.in_(target_project_ids))

    if api_config_id:
        query = query.filter(Issue.api_config_id == api_config_id)
    if status:
        query = query.filter(Issue.status == status.upper())

    issues = query.order_by(Issue.created_at.desc()).all()
    return [enrich_issue_read(i) for i in issues]


@router.get("/{issue_id}", response_model=IssueRead)
def get_issue(
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gets detailed view of a specific issue with field-level schema drift details
    and associated AI diagnosis if available.
    """
    issue = verify_issue_access(issue_id, current_user, db)
    return enrich_issue_read(issue)


@router.post("/{issue_id}/diagnose", response_model=AiDiagnosisRead)
def diagnose_issue_endpoint(
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers Google Gemini AI diagnosis for an existing issue.
    Performs Root Cause Analysis (RCA), evaluates severity, explains failure mechanism,
    and generates actionable remediation recommendations. Stores result in PostgreSQL.
    """
    # 1. Authorize user access to the issue
    issue = verify_issue_access(issue_id, current_user, db)

    # 2. Call Gemini AI diagnosis service (reusing Phase 4 gemini_service)
    try:
        diagnosis = diagnose_issue(db=db, issue_id=issue.id)
        return diagnosis
    except InvalidIssueStateError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except IssueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except (GeminiAPIKeyMissingError, GeminiInvalidKeyError) as e:
        clean_err = sanitize_text(str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI diagnostic service configuration error: {clean_err}"
        )
    except GeminiQuotaExceededError as e:
        clean_err = sanitize_text(str(e))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"AI service quota or rate limit exceeded: {clean_err}"
        )
    except GeminiTimeoutError as e:
        clean_err = sanitize_text(str(e))
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"AI service timed out: {clean_err}"
        )
    except (GeminiNetworkError, GeminiMalformedResponseError, GeminiServiceError) as e:
        clean_err = sanitize_text(str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI diagnostic execution failed: {clean_err}"
        )
    except Exception as e:
        clean_err = sanitize_text(str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected internal server error during issue diagnosis."
        )
