from sqlalchemy import Column, Integer, Float, Boolean, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MonitoringLog(Base):
    __tablename__ = "monitoring_logs"

    id = Column(Integer, primary_key=True, index=True)
    api_config_id = Column(Integer, ForeignKey("api_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Float, nullable=True)
    is_healthy = Column(Boolean, nullable=False, default=True)
    response_headers = Column(JSON, nullable=True)
    response_body = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    api_config = relationship("ApiConfig", back_populates="monitoring_logs")
    issues = relationship("Issue", back_populates="monitoring_log", cascade="all, delete-orphan")
