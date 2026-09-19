from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.api_config import ApiConfig
from app.models.issue import Issue
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates JWT Bearer token and returns the authenticated User.
    Raises 401 Unauthorized if missing, invalid, or expired.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id: Optional[int] = payload.get("user_id")
    email: Optional[str] = payload.get("sub")

    query = db.query(User)
    if user_id:
        user = query.filter(User.id == user_id).first()
    elif email:
        user = query.filter(User.email == email).first()
    else:
        user = None

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user


def verify_project_access(project_id: int, user: User, db: Session) -> Project:
    """
    Verifies that the requested Project exists and belongs to the authenticated user.
    Raises 404 if not found, 403 if belonging to another user.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Workspace with ID {project_id} not found"
        )
    if project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to access this Project Workspace"
        )
    return project


def verify_api_access(api_id: int, user: User, db: Session) -> ApiConfig:
    """
    Verifies that the requested target API exists and belongs to a project owned by the user.
    Raises 404 if not found, 403 if unauthorized.
    """
    api_config = db.query(ApiConfig).filter(ApiConfig.id == api_id).first()
    if not api_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API configuration with ID {api_id} not found"
        )
    if not api_config.project or api_config.project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to access this API configuration"
        )
    return api_config


def verify_issue_access(issue_id: int, user: User, db: Session) -> Issue:
    """
    Verifies that the requested Issue exists and belongs to a project owned by the user.
    Raises 404 if not found, 403 if unauthorized.
    """
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue with ID {issue_id} not found"
        )
    if not issue.project or issue.project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to access this issue"
        )
    return issue
