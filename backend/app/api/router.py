from fastapi import APIRouter
from app.api.endpoints import health, auth, projects, apis, monitoring, issues, dashboard

api_router = APIRouter(prefix="/api/v1")

# Register endpoint modules
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(apis.router)
api_router.include_router(monitoring.router)
api_router.include_router(issues.router)
api_router.include_router(dashboard.router)
