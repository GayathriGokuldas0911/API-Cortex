from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ApiConfig(Base):
    __tablename__ = "api_configs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    method = Column(String(10), default="GET", nullable=False)
    headers = Column(JSON, default=dict)
    body = Column(JSON, nullable=True)
    expected_status_code = Column(Integer, default=200)
    expected_schema = Column(JSON, nullable=True)
    environment = Column(String(50), default="production")
    polling_interval_seconds = Column(Integer, default=60)
    max_response_time_ms = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="api_configs")
    environment_configs = relationship("EnvironmentConfig", back_populates="api_config", cascade="all, delete-orphan")
    openapi_specs = relationship("OpenAPISpec", back_populates="api_config", cascade="all, delete-orphan")
    monitoring_logs = relationship("MonitoringLog", back_populates="api_config", cascade="all, delete-orphan")
    issues = relationship("Issue", back_populates="api_config", cascade="all, delete-orphan")
    schema_validation_issues = relationship("SchemaValidationIssue", back_populates="api_config", cascade="all, delete-orphan")
    ai_diagnoses = relationship("AiDiagnosis", back_populates="api_config", cascade="all, delete-orphan")
