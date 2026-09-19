"""
Database initialization script for API Cortex.
Creates all database tables based on SQLAlchemy models.
"""
import sys
import os

# Add backend root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.models import User, Project, ApiConfig, MonitoringLog, Issue, AiDiagnosis


def init_db():
    print("Initializing API Cortex Database Tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Successfully created all database tables:")
        print("  - users")
        print("  - projects")
        print("  - api_configs")
        print("  - monitoring_logs")
        print("  - issues")
        print("  - ai_diagnoses")
    except Exception as e:
        print(f"Error creating database tables: {e}")
        sys.exit(1)


if __name__ == "__main__":
    init_db()
