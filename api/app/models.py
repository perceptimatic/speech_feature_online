from datetime import datetime
from fastapi import HTTPException, status

from sqlalchemy import (
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

    created = Column(DateTime, nullable=False, default=datetime.now())
    email = Column(String(255), nullable=False, unique=True, index=True)
    id = Column(Integer, primary_key=True, index=True)
    password = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)

    roles = relationship(
        "Role",
        secondary=roles_users_table,
        back_populates="users",
        lazy="selectin",
    )

    def add_role(self, db: Session, role: str):
        """Give the user a role if not already present."""
        role = db.query(Role).filter(Role.role == role)
        if not role:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        self.roles = set(self.roles).union(role)
        db.commit()

    def has_role(self, role: str):
        """Check if user has the given role."""
        return role in [role.role for role in self.roles]

    def is_admin_or_403(self):
        """Raise a 403 if user does not have admin role."""
        if self.has_role("admin"):
            return True
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
