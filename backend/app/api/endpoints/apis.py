from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.api_config import ApiConfig
from app.models.project import Project
from app.schemas.api_config import ApiConfigCreate, ApiConfigRead, ApiConfigUpdate
from app.services.scheduler_service import run_single_api_check_with_db
from app.api.deps import get_current_user, verify_project_access, verify_api_access

router = APIRouter(prefix="/apis", tags=["API Configurations"])


@router.post("/", response_model=ApiConfigRead, status_code=status.HTTP_201_CREATED)
def register_api_config(
    api_in: ApiConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Registers a new target API endpoint under a specific Project Workspace.
    Verifies that the authenticated user owns the target Project Workspace.
    """
    project = verify_project_access(api_in.project_id, current_user, db)

    api_config = ApiConfig(
        project_id=project.id,
        name=api_in.name,
        url=api_in.url,
        method=api_in.method.upper(),
        headers=api_in.headers,
        body=api_in.body,
        expected_status_code=api_in.expected_status_code,
        expected_schema=api_in.expected_schema,
        environment=api_in.environment,
        polling_interval_seconds=api_in.polling_interval_seconds,
        is_active=api_in.is_active
    )
    db.add(api_config)
    db.commit()
    db.refresh(api_config)
    return api_config


@router.get("/", response_model=List[ApiConfigRead])
def list_api_configs(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists registered APIs accessible to the authenticated user,
    with optional project_id filtering.
    """
    if project_id is not None:
        verify_project_access(project_id, current_user, db)
        query = db.query(ApiConfig).filter(ApiConfig.project_id == project_id)
    else:
        user_projects = db.query(Project.id).filter(Project.user_id == current_user.id).all()
        target_project_ids = [p[0] for p in user_projects]
        query = db.query(ApiConfig).filter(ApiConfig.project_id.in_(target_project_ids))

    return query.all()


@router.get("/{api_id}", response_model=ApiConfigRead)
def get_api_config(
    api_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Gets details for a specific registered API, enforcing user authorization."""
    api_config = verify_api_access(api_id, current_user, db)
    return api_config


@router.post("/{api_id}/trigger")
async def trigger_manual_api_check(
    api_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers an immediate manual monitoring check for a registered API.
    Verifies that the user has authorization for this API.
    """
    api_config = verify_api_access(api_id, current_user, db)

    result = await run_single_api_check_with_db(api_config.id)
    return {
        "message": f"Manual monitoring check executed for API '{api_config.name}'",
        "result": result
    }


@router.put("/{api_id}", response_model=ApiConfigRead)
def update_api_config(
    api_id: int,
    api_in: ApiConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates an existing target API configuration."""
    api_config = verify_api_access(api_id, current_user, db)
    update_data = api_in.model_dump(exclude_unset=True)
    if "method" in update_data and update_data["method"]:
        update_data["method"] = update_data["method"].upper()
    for field, value in update_data.items():
        setattr(api_config, field, value)
    db.commit()
    db.refresh(api_config)
    return api_config


@router.delete("/{api_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_config(
    api_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes an existing target API configuration and cascades associated logs/issues."""
    api_config = verify_api_access(api_id, current_user, db)
    db.delete(api_config)
    db.commit()
    return None

