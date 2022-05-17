from typing import Optional

from pydantic import BaseModel, EmailStr


class UserIn(BaseModel):
    """User Schema"""

    password: str
    is_admin: Optional[str]
    email: EmailStr
    full_name: Optional[str] = None
    username: str

    class Config:
        orm_mode = True


class TokenData(BaseModel):
    username: Optional[str] = None
