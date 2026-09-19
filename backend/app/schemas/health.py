from pydantic import BaseModel
from typing import Dict, Any


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    database: str
    timestamp: str
    details: Dict[str, Any]
