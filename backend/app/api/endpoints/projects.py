from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.api.deps import get_current_user, verify_project_access

router = APIRouter(prefix="/projects", tags=["Project Workspaces"])


@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a new isolated Project Workspace owned by the authenticated user."""
    project = Project(
        user_id=current_user.id,
        name=project_in.name,
        description=project_in.description
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=List[ProjectRead])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all Project Workspaces owned by the authenticated user."""
    return db.query(Project).filter(Project.user_id == current_user.id).all()


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Gets a specific Project Workspace by ID, enforcing user authorization."""
    project = verify_project_access(project_id, current_user, db)
    return project


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates an existing Project Workspace."""
    project = verify_project_access(project_id, current_user, db)
    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a Project Workspace and cascades all associated APIs, issues, and logs."""
    project = verify_project_access(project_id, current_user, db)
    db.delete(project)
    db.commit()
    return None

