from datetime import datetime, timedelta
from json import loads
from os import path

import boto3
from celery.backends.database import TaskExtended
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
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, Session

from app.database import Base
from app.settings import Settings


def update_model(model, attrs: dict):
    """attach new values to model"""
    for k, v in attrs.items():
        if hasattr(model, k):
            setattr(model, k, v)
    return model


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
    created = Column(DateTime, nullable=False, default=func.now())
    id = Column(Integer, primary_key=True, index=True)
    taskmeta_id = Column(String(255), nullable=True, unique=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    can_retry = False
    taskmeta = None

    def load_can_retry_value(self):
        """If taskmeta property (relationship w/ possibly nonexistant
        TaskExtended table) exists, check that job files exist in s3,
        allowing job to be retried
        """
        if (
            self.taskmeta
            and self.taskmeta.kwargs
            and self.created > (datetime.now() - timedelta(days=7))
        ):
            kwargs = loads(self.taskmeta.kwargs)
            if config := kwargs.get("config"):
                client = boto3.client("s3")
                files = config["files"]
                if files:
                    prefixes = {path.split(f)[0] for f in files}
                    keycount = 0
                    # a job might have files with several prefixes due to mixing and matching via retry
                    # so we'll pull out the unique prefixes and test they exist
                    for prefix in prefixes:
                        paginator = client.get_paginator("list_objects_v2")
                        page_iterator = paginator.paginate(
                            Bucket=Settings.BUCKET_NAME, Prefix=prefix
                        )
                        for page in page_iterator:
                            keycount += page["KeyCount"]
                    if keycount >= len(files):
                        self.can_retry = True

    def load_taskmeta(self, db):
        """Load task meta and attach, assumes that TaskExtended table existence check
        has been performed by caller
        """
        self.taskmeta = (
            db.query(TaskExtended)
            .filter(TaskExtended.task_id == self.taskmeta_id)
            .first()
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

    id = Column(Integer, primary_key=True, index=True)
    active = Column(Boolean, nullable=False, default=False)
    created = Column(DateTime, nullable=False, default=datetime.now())
    email = Column(String(255), nullable=False, unique=True, index=True)
    password = Column(String(255), nullable=False)
    verification_code = Column(String(255), nullable=True)
    verification_tries = Column(Integer, nullable=False, default=0)
    username = Column(String(255), nullable=False)

    roles = relationship(
        "Role",
        secondary=roles_users_table,
        back_populates="users",
        lazy="selectin",
    )

    tasks = relationship(
        "UserTask",
    )

    def add_role(self, db: Session, role: str):
        """Give the user a role if not already present."""
        role = db.query(Role).filter(Role.role == role).one()
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
