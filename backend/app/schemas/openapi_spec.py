from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class OpenAPISpecBase(BaseModel):
    title: str
    version: str = "1.0.0"
    spec_type: str = "JSON"
    raw_spec: Dict[str, Any]
    parsed_endpoints: Optional[List[Dict[str, Any]]] = None


class OpenAPISpecCreate(OpenAPISpecBase):
    project_id: int
    api_config_id: int


class OpenAPISpecRead(OpenAPISpecBase):
    id: int
    project_id: int
    api_config_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
