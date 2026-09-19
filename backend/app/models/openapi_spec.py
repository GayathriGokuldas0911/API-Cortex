from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class OpenAPISpec(Base):
    __tablename__ = "openapi_specs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    api_config_id = Column(Integer, ForeignKey("api_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    version = Column(String(50), default="1.0.0")
    spec_type = Column(String(20), default="JSON")  # JSON or YAML
    raw_spec = Column(JSON, nullable=False)  # Parsed OpenAPI 3.0 / Swagger schema definition
    parsed_endpoints = Column(JSON, nullable=True)  # Extracted path operations
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="openapi_specs")
    api_config = relationship("ApiConfig", back_populates="openapi_specs")
