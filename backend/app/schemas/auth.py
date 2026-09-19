from typing import Optional
from pydantic import BaseModel, EmailStr
from app.schemas.user import UserRead


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserRead] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    user_id: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
