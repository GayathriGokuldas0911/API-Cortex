import os
import sys

# Ensure backend root is on sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api.router import api_router
from app.services.prometheus_metrics import get_metrics_response
from app.services.scheduler_service import start_monitoring_scheduler, stop_monitoring_scheduler

# Import all models to ensure they are registered with Base metadata
import app.models

app = FastAPI(
    title=settings.APP_NAME,
    description="API Health Monitoring Platform - Backend Engine",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Expose Prometheus time-series metrics endpoint at /metrics
@app.get("/metrics", tags=["Metrics"], summary="Prometheus Metrics Exporter")
def metrics():
    """Endpoint scraped by Prometheus to collect time-series monitoring metrics."""
    return get_metrics_response()

from sqlalchemy.exc import SQLAlchemyError
from fastapi.responses import JSONResponse

# Global Database Exception Handler (Prevents stack trace / secret leak)
@app.exception_handler(SQLAlchemyError)
def sqlalchemy_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred while processing the request."}
    )

# Include REST API Router
app.include_router(api_router)


@app.on_event("startup")
def on_startup():
    """Create database tables and launch background monitoring scheduler on application startup."""
    try:
        Base.metadata.create_all(bind=engine)
        print("API Cortex database models verified.")
    except Exception as e:
        print(f"Warning: Database initialization error: {e}")

    # Start background polling scheduler
    start_monitoring_scheduler(interval_seconds=15)


@app.on_event("shutdown")
def on_shutdown():
    """Stop background monitoring scheduler on shutdown."""
    stop_monitoring_scheduler()


@app.get("/", tags=["Root"])
def read_root():
    return {
        "app_name": settings.APP_NAME,
        "status": "online",
        "metrics_endpoint": "/metrics",
        "documentation": "/docs",
        "health_check": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=settings.DEBUG)
