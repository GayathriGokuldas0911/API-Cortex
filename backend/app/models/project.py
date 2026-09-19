from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="projects")
    api_configs = relationship("ApiConfig", back_populates="project", cascade="all, delete-orphan")
    environment_configs = relationship("EnvironmentConfig", back_populates="project", cascade="all, delete-orphan")
    openapi_specs = relationship("OpenAPISpec", back_populates="project", cascade="all, delete-orphan")
    issues = relationship("Issue", back_populates="project", cascade="all, delete-orphan")
    schema_validation_issues = relationship("SchemaValidationIssue", back_populates="project", cascade="all, delete-orphan")
    ai_diagnoses = relationship("AiDiagnosis", back_populates="project", cascade="all, delete-orphan")
