from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AiDiagnosis(Base):
    __tablename__ = "ai_diagnoses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    api_config_id = Column(Integer, ForeignKey("api_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    root_cause = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    possible_impact = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    raw_ai_response = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="ai_diagnoses")
    api_config = relationship("ApiConfig", back_populates="ai_diagnoses")
    issue = relationship("Issue", back_populates="ai_diagnosis")
