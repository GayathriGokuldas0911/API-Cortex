from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict
from app.schemas.ai_diagnosis import AiDiagnosisRead


class SchemaValidationIssueRead(BaseModel):
    id: int
    project_id: int
    api_config_id: int
    issue_id: int
    drift_type: str
    field_path: str
    expected_type: Optional[str] = None
    actual_type: Optional[str] = None
    description: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IssueBase(BaseModel):
    issue_type: str
    status_code: Optional[int] = None
    error_details: str
    schema_validation_results: Optional[Dict[str, Any]] = None
    status: str = "OPEN"


class IssueCreate(IssueBase):
    project_id: int
    api_config_id: int
    monitoring_log_id: Optional[int] = None


class IssueRead(IssueBase):
    id: int
    project_id: int
    api_config_id: int
    monitoring_log_id: Optional[int] = None
    created_at: datetime
    api_name: Optional[str] = None
    api_url: Optional[str] = None
    api_method: Optional[str] = None
    project_name: Optional[str] = None
    expected_schema: Optional[Dict[str, Any]] = None
    response_body: Optional[Any] = None
    schema_validation_issues: Optional[List[SchemaValidationIssueRead]] = []
    ai_diagnosis: Optional[AiDiagnosisRead] = None

    model_config = ConfigDict(from_attributes=True)
