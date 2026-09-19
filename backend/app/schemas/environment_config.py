from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class EnvironmentConfigBase(BaseModel):
    environment_name: str = "production"
    base_url: str
    headers: Optional[Dict[str, Any]] = {}
    variables: Optional[Dict[str, Any]] = {}


class EnvironmentConfigCreate(EnvironmentConfigBase):
    project_id: int
    api_config_id: int


class EnvironmentConfigRead(EnvironmentConfigBase):
    id: int
    project_id: int
    api_config_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
