from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class AiDiagnosisBase(BaseModel):
    root_cause: str
    explanation: str
    severity: str
    possible_impact: str
    recommended_action: str
    raw_ai_response: Optional[Dict[str, Any]] = None


class AiDiagnosisCreate(AiDiagnosisBase):
    project_id: int
    api_config_id: int
    issue_id: int


class AiDiagnosisRead(AiDiagnosisBase):
    id: int
    project_id: int
    api_config_id: int
    issue_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
