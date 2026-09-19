from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, HttpUrl, ConfigDict


class ApiConfigBase(BaseModel):
    name: str
    url: str
    method: str = "GET"
    headers: Optional[Dict[str, Any]] = {}
    body: Optional[Dict[str, Any]] = None
    expected_status_code: int = 200
    expected_schema: Optional[Dict[str, Any]] = None
    environment: str = "production"
    polling_interval_seconds: int = 60
    is_active: bool = True


class ApiConfigCreate(ApiConfigBase):
    project_id: int


class ApiConfigUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
    expected_status_code: Optional[int] = None
    expected_schema: Optional[Dict[str, Any]] = None
    environment: Optional[str] = None
    polling_interval_seconds: Optional[int] = None
    is_active: Optional[bool] = None


class ApiConfigRead(ApiConfigBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
