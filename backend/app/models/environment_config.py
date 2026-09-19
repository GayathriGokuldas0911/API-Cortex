from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class EnvironmentConfig(Base):
    __tablename__ = "environment_configs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    api_config_id = Column(Integer, ForeignKey("api_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    environment_name = Column(String(50), nullable=False, default="production")  # e.g., dev, staging, production
    base_url = Column(Text, nullable=False)
    headers = Column(JSON, default=dict)
    variables = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="environment_configs")
    api_config = relationship("ApiConfig", back_populates="environment_configs")
