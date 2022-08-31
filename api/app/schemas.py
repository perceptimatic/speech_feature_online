from datetime import datetime
from typing import Generic, List, Optional, TypeVar, Union

from pydantic import BaseModel, EmailStr, Json
from pydantic.generics import GenericModel


class UserUpdate(BaseModel):
    """Updatable user"""

    is_admin: Optional[str] = None
    password: Optional[str] = None
    username: Optional[str] = None


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
    date_done: datetime
    kwargs: Union[Json, None]
    status: str
    result: Union[str, dict, None]
    task_id: str
    traceback: Union[str, None]

    class Config:
        orm_mode = True


class UserTaskOut(BaseModel):
    """Tasks belonging to the user"""

    id: int
    can_retry: Union[bool, None]
    created: datetime
    taskmeta_id: str
    taskmeta: Union[TaskOut, None]
    user_id: int

    class Config:
        orm_mode = True


class UserVerification(BaseModel):
    """Payload for user verification"""

    verification_code: str
    user_email: EmailStr


class UserPasswordReset(BaseModel):
    """Payload for user password reset"""

    user_email: EmailStr


T = TypeVar("T")


class PaginatedOutput(GenericModel, Generic[T]):
    """Generic Schema for paginated result"""

    data: List[T]
    desc: Union[bool, None]
    page: int
    per_page: int
    sort: Union[str, None]
    total: int
