from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    api_config_id = Column(Integer, ForeignKey("api_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    monitoring_log_id = Column(Integer, ForeignKey("monitoring_logs.id", ondelete="CASCADE"), nullable=True, index=True)
    issue_type = Column(String(50), nullable=False)  # HTTP_ERROR, TIMEOUT, SCHEMA_DRIFT, MISSING_FIELD, TYPE_MISMATCH
    status_code = Column(Integer, nullable=True)
    error_details = Column(Text, nullable=False)
    schema_validation_results = Column(JSON, nullable=True)
    status = Column(String(20), default="OPEN")  # OPEN, DIAGNOSED, RESOLVED
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    project = relationship("Project", back_populates="issues")
    api_config = relationship("ApiConfig", back_populates="issues")
    monitoring_log = relationship("MonitoringLog", back_populates="issues")
    schema_validation_issues = relationship("SchemaValidationIssue", back_populates="issue", cascade="all, delete-orphan")
    ai_diagnosis = relationship("AiDiagnosis", back_populates="issue", uselist=False, cascade="all, delete-orphan")
