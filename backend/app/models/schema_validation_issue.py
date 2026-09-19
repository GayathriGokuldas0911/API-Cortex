from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class SchemaValidationIssue(Base):
    __tablename__ = "schema_validation_issues"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    api_config_id = Column(Integer, ForeignKey("api_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True)
    drift_type = Column(String(50), nullable=False)  # MISSING_FIELD, UNEXPECTED_FIELD, TYPE_MISMATCH, STRUCTURAL_DRIFT
    field_path = Column(String(255), nullable=False)  # e.g., "data.users[0].email"
    expected_type = Column(String(50), nullable=True)
    actual_type = Column(String(50), nullable=True)
    description = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="schema_validation_issues")
    api_config = relationship("ApiConfig", back_populates="schema_validation_issues")
    issue = relationship("Issue", back_populates="schema_validation_issues")
