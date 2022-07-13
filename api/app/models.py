from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
)
from sqlalchemy.orm import relationship, Session

from app.database import Base


roles_users_table = Table(
    "roles_users",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)


class UserTask(Base):
    """Intermediate table between celery's taskmeta table and the user table.
    B/c celery handles the task tables, we don't have access to them here and have
    to handle the joins manually for now.
    """

    __tablename__ = "tasks_users"
    created = Column(DateTime, nullable=False, default=datetime.now())
    id = Column(Integer, primary_key=True, index=True)
    taskmeta_id = Column(String(255), nullable=True, unique=True)
    user_id = Column(Integer, ForeignKey("users.id"))


class Role(Base):
    """Role model (hopefully a positive one)."""

    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(255), nullable=False, unique=True)

    users = relationship(
        "User",
        secondary=roles_users_table,
        back_populates="roles",
    )


class User(Base):
    """User model."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    username = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    active = Column(Boolean, nullable=False, default=False)
    verification_code = Column(String(255), nullable=True)
    verification_tries = Column(Integer, nullable=False, default=0)
    created = Column(DateTime, nullable=False, default=datetime.now())

    roles = relationship(
        "Role",
        secondary=roles_users_table,
        back_populates="users",
        lazy="selectin",
    )

    def add_role(self, db: Session, role: str):
        """Give the user a role if not already present."""
        role = db.query(Role).filter(Role.role == role).one()
        self.roles = set(self.roles).union(role)
        db.commit()

    def load_tasks(self, db: Session):
        """load tasks"""
        return db.query(UserTask).filter(UserTask.user_id == self.id).all()

    def has_role(self, role: str):
        """Check if user has the given role."""
        return role in [role.role for role in self.roles]

    def is_admin_or_403(self):
        """Raise a 403 if user does not have admin role."""
        if self.has_role("admin"):
            return True
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
