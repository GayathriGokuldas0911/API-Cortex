from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="API Cortex Health Check",
    description="Verifies system operational status and tests connection to PostgreSQL database."
)
def health_check(db: Session = Depends(get_db)):
    db_status = "healthy"
    db_details = "Connected to PostgreSQL successfully"

    try:
        # Test query to PostgreSQL
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "unhealthy"
        db_details = f"PostgreSQL connection failed: {str(e)}"

    return HealthResponse(
        status="healthy" if db_status == "healthy" else "degraded",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database=db_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        details={
            "database_message": db_details,
            "version": "1.0.0"
        }
    )
