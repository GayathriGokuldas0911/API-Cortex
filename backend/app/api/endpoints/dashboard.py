from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.api_config import ApiConfig
from app.models.monitoring_log import MonitoringLog
from app.models.issue import Issue
from app.models.schema_validation_issue import SchemaValidationIssue
from app.models.ai_diagnosis import AiDiagnosis
from app.schemas.dashboard import DashboardSummaryRead, DashboardApiHealthSummary
from app.api.endpoints.issues import enrich_issue_read
from app.api.deps import get_current_user, verify_project_access

router = APIRouter(prefix="/dashboard", tags=["Dashboard Analytics"])


@router.get("/summary", response_model=DashboardSummaryRead)
def get_dashboard_summary(
    project_id: Optional[int] = Query(None, description="Optional Project Workspace ID to filter dashboard metrics"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Consolidated dashboard summary metrics for the authenticated user's workspace.
    Provides API counts, availability %, latency, schema drift stats, and recent issues.
    Strictly isolated per user and project workspace.
    """
    project_name = None

    if project_id is not None:
        project = verify_project_access(project_id, current_user, db)
        project_name = project.name
        target_project_ids = [project.id]
        total_projects = 1
    else:
        user_projects = db.query(Project).filter(Project.user_id == current_user.id).all()
        target_project_ids = [p.id for p in user_projects]
        total_projects = len(target_project_ids)

    # Empty project workspace handling
    if not target_project_ids:
        return DashboardSummaryRead(
            project_id=project_id,
            project_name=project_name,
            total_projects=0,
            total_apis=0,
            healthy_apis=0,
            unhealthy_apis=0,
            total_requests=0,
            total_errors=0,
            availability_percentage=100.0,
            avg_response_time_ms=0.0,
            schema_validation_issues=0,
            schema_drift_issues=0,
            unresolved_issues=0,
            ai_diagnoses_count=0,
            recent_issues=[],
            api_health_list=[]
        )

    # Retrieve all APIs under target projects
    apis = db.query(ApiConfig).filter(ApiConfig.project_id.in_(target_project_ids)).all()
    total_apis = len(apis)
    api_ids = [a.id for a in apis]

    if not api_ids:
        return DashboardSummaryRead(
            project_id=project_id,
            project_name=project_name,
            total_projects=total_projects,
            total_apis=0,
            healthy_apis=0,
            unhealthy_apis=0,
            total_requests=0,
            total_errors=0,
            availability_percentage=100.0,
            avg_response_time_ms=0.0,
            schema_validation_issues=0,
            schema_drift_issues=0,
            unresolved_issues=0,
            ai_diagnoses_count=0,
            recent_issues=[],
            api_health_list=[]
        )

    # Open issues & unhealthy status calculation
    open_issues = db.query(Issue).filter(
        Issue.api_config_id.in_(api_ids),
        Issue.status == "OPEN"
    ).all()
    unhealthy_api_ids = set(i.api_config_id for i in open_issues)
    unhealthy_apis = len(unhealthy_api_ids)
    healthy_apis = total_apis - unhealthy_apis

    # Monitoring log statistics (PostgreSQL aggregated history)
    total_requests = db.query(func.count(MonitoringLog.id)).filter(
        MonitoringLog.api_config_id.in_(api_ids)
    ).scalar() or 0

    total_errors = db.query(func.count(MonitoringLog.id)).filter(
        MonitoringLog.api_config_id.in_(api_ids),
        MonitoringLog.is_healthy == False
    ).scalar() or 0

    avg_latency = db.query(func.avg(MonitoringLog.response_time_ms)).filter(
        MonitoringLog.api_config_id.in_(api_ids)
    ).scalar()
    avg_response_time_ms = round(float(avg_latency), 2) if avg_latency is not None else 0.0

    if total_requests > 0:
        availability_percentage = round(((total_requests - total_errors) / total_requests) * 100.0, 2)
    else:
        availability_percentage = 100.0

    # Schema issues & Drift statistics
    schema_val_count = db.query(func.count(SchemaValidationIssue.id)).filter(
        SchemaValidationIssue.project_id.in_(target_project_ids)
    ).scalar() or 0

    drift_issues_count = db.query(func.count(Issue.id)).filter(
        Issue.project_id.in_(target_project_ids),
        Issue.issue_type.in_(["SCHEMA_DRIFT", "MISSING_FIELD", "TYPE_MISMATCH"])
    ).scalar() or 0

    ai_diagnoses_count = db.query(func.count(AiDiagnosis.id)).filter(
        AiDiagnosis.project_id.in_(target_project_ids)
    ).scalar() or 0

    # Recent issues list (latest 5)
    recent_issues_records = db.query(Issue).filter(
        Issue.project_id.in_(target_project_ids)
    ).order_by(Issue.created_at.desc()).limit(5).all()
    recent_issues = [enrich_issue_read(i) for i in recent_issues_records]

    # API health card items
    api_health_list: List[DashboardApiHealthSummary] = []
    for api in apis:
        is_healthy = api.id not in unhealthy_api_ids
        latest_log = db.query(MonitoringLog).filter(
            MonitoringLog.api_config_id == api.id
        ).order_by(MonitoringLog.timestamp.desc()).first()

        api_health_list.append(DashboardApiHealthSummary(
            api_id=api.id,
            name=api.name,
            url=api.url,
            method=api.method,
            is_healthy=is_healthy,
            status_code=latest_log.status_code if latest_log else None,
            response_time_ms=latest_log.response_time_ms if latest_log else None,
            last_checked=latest_log.timestamp.isoformat() if latest_log and latest_log.timestamp else None
        ))

    return DashboardSummaryRead(
        project_id=project_id,
        project_name=project_name,
        total_projects=total_projects,
        total_apis=total_apis,
        healthy_apis=healthy_apis,
        unhealthy_apis=unhealthy_apis,
        total_requests=total_requests,
        total_errors=total_errors,
        availability_percentage=availability_percentage,
        avg_response_time_ms=avg_response_time_ms,
        schema_validation_issues=schema_val_count,
        schema_drift_issues=drift_issues_count,
        unresolved_issues=len(open_issues),
        ai_diagnoses_count=ai_diagnoses_count,
        recent_issues=recent_issues,
        api_health_list=api_health_list
    )
