""" Utility functions for use in API routes; use elsewhere will likely result in circular import issues """
from datetime import datetime, timedelta
import logging
import random
import string

from fastapi import Depends, status, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User, Role
from app.settings import settings
from app.schemas import TokenData, UserIn

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

logger = logging.getLogger(__name__)


def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_user(db: Session, user_id: int) -> User:
    """Fetch a user based on id"""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    """Fetch a user based on id"""
    return db.query(User).filter(User.email == email).first()


def get_password_hash(password):
    """Hash a password according to specified context."""
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    """Verify the user's password"""
    return pwd_context.verify(plain_password, hashed_password)


def authenticate_user(db, email: str, password: str):
    """Find the user in the database and verify password"""
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    if not user.active:
        return False
    return user


def create_access_token(data: dict, exp_mins: int = None):
    """Create a JWT for the user"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        timedelta(minutes=(exp_mins or settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGO
    )
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme), db=Depends(get_db)
) -> User:
    """Resolve user from JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGO])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
    except JWTError as err:
        logger.error(err)
        raise credentials_exception
    user = get_user(db, user_id=token_data.user_id)
    if user is None:
        raise credentials_exception
    return user


async def resolve_user(db: Session, current_user: User, user_id: int):
    """If a route is restricted to resource owner (i.e., user with user_id)
    or admin user, authorize or raise unauthorized
    """
    if (current_user.id != user_id) and not current_user.has_role("admin"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user = (
        current_user
        if current_user.id == user_id
        else db.query(User).filter(User.id == user_id).one()
    )

    return user


async def create_user(db: Session, user: UserIn, code: str):
    """Create a new user."""

    new_user = User(
        email=user.email,
        password=get_password_hash(user.password),
        username=user.username,
        verification_code=code,
        created=datetime.now(),
    )

    user_role = db.query(Role).filter(Role.role == "user").first()
    new_user.roles = [user_role]
    if user.is_admin:
        user_role = db.query(Role).filter(Role.role == "admin").first()
        new_user.roles.append(user_role)

    db.add(new_user)
    db.commit()

    return new_user


def make_randomish_string(all_cap=True, k=6):
    """Generate a randomish string"""
    letters = string.ascii_uppercase if all_cap else string.ascii_letters
    return "".join(random.choices(letters + string.digits, k=k))
