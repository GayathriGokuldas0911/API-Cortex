from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.monitoring_log import MonitoringLog
from app.models.api_config import ApiConfig

router = APIRouter(prefix="/monitoring", tags=["Monitoring Logs"])


@router.get("/logs")
def get_monitoring_logs(
    project_id: Optional[int] = Query(None, description="Filter logs by Project Workspace ID"),
    api_config_id: Optional[int] = Query(None, description="Filter logs by API Config ID"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Retrieves historical monitoring execution logs."""
    query = db.query(MonitoringLog)

    if api_config_id:
        query = query.filter(MonitoringLog.api_config_id == api_config_id)
    elif project_id:
        query = query.join(ApiConfig).filter(ApiConfig.project_id == project_id)

    logs = query.order_by(MonitoringLog.timestamp.desc()).limit(limit).all()

    return [
        {
            "id": log.id,
            "api_config_id": log.api_config_id,
            "status_code": log.status_code,
            "response_time_ms": log.response_time_ms,
            "is_healthy": log.is_healthy,
            "error_message": log.error_message,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        }
        for log in logs
    ]
