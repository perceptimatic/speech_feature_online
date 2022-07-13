from logging import getLogger

from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.models import User
from app.database import SessionLocal
from app.settings import settings

logger = getLogger(__name__)


def create_admin_user():
    """Create an admin user when running app for the first time"""
    db: Session = SessionLocal()
    exists = db.query(User).filter(User.username == "admin").first()
    if exists:
        logger.error("Admin user already exists!")
        return
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password = settings.FAST_API_DEFAULT_ADMIN_PASSWORD
    admin_user = User(
        **{
            "username": "admin",
            "email": "admin@example.com",
            "password": pwd_context.hash(password),
            "active": True,
        }
    )
    db.add(admin_user)
    db.commit()


if __name__ == "__main__":
    create_admin_user()
