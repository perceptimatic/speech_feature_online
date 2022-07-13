from datetime import datetime
from typing import Any, List, Optional, Union

from pydantic import BaseModel, EmailStr


class UserIn(BaseModel):
    """User Schema"""

    email: EmailStr
    is_admin: Optional[str] = None
    password: str
    username: str


class Role(BaseModel):
    """A role that can be associated with a user"""

    id: int
    role: str

    class Config:
        orm_mode = True


class User(BaseModel):
    """The user model"""

    id: int
    created: datetime
    email: str
    roles: List[Role]
    username: str

    class Config:
        orm_mode = True


class Token(BaseModel):
    """Token request"""

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Token data contexts"""

    user_id: Optional[int] = None


class LoginRequest(BaseModel):
    """Fields sent from login request"""

    password: str
    email: EmailStr


class TaskOut(BaseModel):
    """Celery task, model from celery.backends.database"""

    id: int
    task_id: str
    status: str
    result: Union[str, dict, None]
    date_done: datetime
    traceback: Union[str, None]

    class Config:
        orm_mode = True


class UserTaskOut(BaseModel):
    """Tasks belonging to the user"""

    id: int
    created: datetime
    taskmeta_id: str
    task_info: Union[TaskOut, None]
    user_id: int

    class Config:
        orm_mode = True


class UserVerification(BaseModel):
    verification_code: str
