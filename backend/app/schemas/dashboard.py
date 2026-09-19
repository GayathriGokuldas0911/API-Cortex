from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.issue import IssueRead


class DashboardApiHealthSummary(BaseModel):
    api_id: int
    name: str
    url: str
    method: str
    is_healthy: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    last_checked: Optional[str] = None


class DashboardSummaryRead(BaseModel):
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    total_projects: int = 0
    total_apis: int = 0
    healthy_apis: int = 0
    unhealthy_apis: int = 0
    total_requests: int = 0
    total_errors: int = 0
    availability_percentage: float = 100.0
    avg_response_time_ms: float = 0.0
    schema_validation_issues: int = 0
    schema_drift_issues: int = 0
    unresolved_issues: int = 0
    ai_diagnoses_count: int = 0
    recent_issues: List[IssueRead] = []
    api_health_list: List[DashboardApiHealthSummary] = []

    model_config = ConfigDict(from_attributes=True)
