from dataclasses import asdict, dataclass
import logging
import random
import string
from os import path
from typing import Union

import boto3
from celery import Celery, signature
from celery.backends.database import TaskExtended
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy import desc
from sqlalchemy.orm import Session, Query
from sqlalchemy.exc import ProgrammingError

from app.database import Base
from app.models import UserTask, update_model
from app.schemas import (
    LoginRequest,
    PaginatedOutput,
    Token,
    User,
    UserIn,
    UserPasswordReset,
    UserTaskOut,
    UserUpdate,
    UserVerification,
)
from app.settings import settings
from app.util import (
    authenticate_user,
    create_access_token,
    create_user,
    find,
    get_db,
    get_current_user,
    get_password_hash,
    get_user_by_email,
    resolve_user,
)
from app.validators import raise_422, validate_job_request, ValidationViolation

# initialise our app
app = FastAPI()


logger = logging.getLogger(__name__)

# static files, such as processor-schema.json
app.mount(
    "/static",
    StaticFiles(directory=path.join(settings.PROJECT_ROOT, "static")),
    name="static",
)

# celery config
celery_app = Celery("speech_features", broker="redis://redis:6379/0")

celery_app.conf.task_routes = {
    "app.worker.process_shennong_job": {"queue": settings.PROCESSING_QUEUE},
    "app.worker.test": {"queue": settings.PROCESSING_QUEUE},
    "app.worker.verify_user_email": {"queue": settings.NOTIFICATION_QUEUE},
    "app.worker.reset_password": {"queue": settings.NOTIFICATION_QUEUE},
}

# util
def make_randomish_string(all_cap=True, k=6):
    """Generat a randomish string"""
    letters = string.ascii_uppercase if all_cap else string.ascii_letters
    return "".join(random.choices(letters + string.digits, k=k))


@dataclass
class PaginationParams:
    """Pagination parameters"""

    page: int = (1,)
    per_page: int = (25,)
    sort: Union[str, None] = (None,)
    desc: Union[bool, None] = (None,)


def paginate(query: Query, model: Base, params: PaginationParams):
    """Paginate a query"""

    total = query.count()

    if params.sort and hasattr(model, params.sort):
        query = query.order_by(desc(params.sort) if params.desc else params.sort)

    return {
        "data": query.offset((params.page - 1) * params.per_page)
        .limit(params.per_page)
        .all(),
        "total": total,
        **asdict(params),
    }


async def pagination_params(
    page: int = 1,
    per_page: int = 25,
    sort: Union[str, None] = None,
    desc: Union[bool, None] = None,
):
    """Pagination dependency"""
    return PaginationParams(page=page, per_page=per_page, sort=sort, desc=desc)


# routes
@app.get("/api/temp-creds")
async def get_temp_creds(current_user: User = Depends(get_current_user)):
    """Fetch temporary S3 creds for uploading a file through the front end"""
    client = boto3.client("sts")
    response = client.get_session_token(
        DurationSeconds=900,
    )
    return response


@app.post("/api/shennong-job", response_model=bool, status_code=status.HTTP_201_CREATED)
async def store_shennong_job(
    request: Request, current_user: User = Depends(get_current_user), db=Depends(get_db)
):
    """Create a new job and return."""

    job = await request.json()

    validate_job_request(job)

    email = job.pop("email")

    task = celery_app.send_task(
        "app.worker.process_shennong_job",
        kwargs={"config": job},
        link=[
            signature(
                "app.worker.notify_job_complete",
                args=(email,),
                queue=settings.NOTIFICATION_QUEUE,
            )
        ],
    )

    user_task = UserTask(user_id=current_user.id, taskmeta_id=task.id)

    db.add(user_task)

    db.commit()

    return True


@app.post("/api/test-job", response_model=bool, status_code=status.HTTP_201_CREATED)
async def store_test_job(
    request: Request, current_user: User = Depends(get_current_user), db=Depends(get_db)
):
    """Create a new job and return."""

    args = await request.json()

    task = celery_app.send_task(
        "app.worker.test",
        [args],
        link=[
            signature(
                "app.worker.notify_job_complete",
                queue=settings.NOTIFICATION_QUEUE,
                immutable=True,
                args=("example@example.com", "google.com"),
            )
        ],
    )

    user_task = UserTask(user_id=current_user.id, taskmeta_id=task.id)

    db.add(user_task)

    db.commit()

    return True


@app.post("/api/token", response_model=Token)
async def login_for_access_token(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return access token"""
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username},
    )

    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/users/current", response_model=User)
async def fetch_current_user(current_user: User = Depends(get_current_user)):
    """Return the current user"""
    return current_user


@app.get("/api/users/{user_id}/tasks", response_model=PaginatedOutput[UserTaskOut])
async def fetch_user_tasks(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
    pagination=Depends(pagination_params),
):
    """Return the user's tasks"""
    user = await resolve_user(db, current_user, user_id)

    # if no job has been run yet, celery's task tables won't exist, in which case we'll bail with an empty result
    # would be great if we could check dynamically in relationship but doesn't seem possible :(
    # if we need to do this anywhere else, can just put this as a method on the model
    try:
        db.query(TaskExtended).first()
    except ProgrammingError:
        return []

    user_tasks_query = db.query(UserTask).filter(UserTask.user_id == user.id)

    user_tasks = paginate(user_tasks_query, UserTask, pagination)

    # poor man's eager load -- grab all foreign keys, then do an in statement and bind
    tasks = {
        task.task_id: task
        for task in db.query(TaskExtended)
        .filter(
            TaskExtended.task_id.in_([task.taskmeta_id for task in user_tasks["data"]])
        )
        .all()
    }

    for ut in user_tasks["data"]:
        if tasks.get(ut.taskmeta_id):
            ut.taskmeta = tasks[ut.taskmeta_id]
            ut.load_can_retry_value()

    return user_tasks


@app.get("/api/users/{user_id}/tasks/{task_id}", response_model=UserTaskOut)
async def get_task(
    user_id: int,
    task_id: int,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return a user task, with taskmeta if requested"""

    # ensure table exists
    try:
        db.query(TaskExtended).first()
    except ProgrammingError:
        return []

    user = await resolve_user(db, current_user, user_id)

    task = find(user.tasks, lambda tsk: tsk.id == task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found!",
        )

    task.load_taskmeta(db)

    task.load_can_retry_value()

    return task


@app.post("/api/users", response_model=User)
async def post_user(request: UserIn, db=Depends(get_db)):
    """Create a new user"""
    existing = get_user_by_email(db, request.email)
    if existing:
        raise_422([ValidationViolation(field="email", message="Email already taken!")])

    verification_code = make_randomish_string()

    user = await create_user(db, request, verification_code)

    celery_app.send_task(
        "app.worker.verify_user_email", [user.email, verification_code]
    )

    return user


@app.patch("/api/users/{user_id}", response_model=User)
async def update_user(
    user_id: int,
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """update a user record"""

    user = await resolve_user(db, current_user, user_id)

    updated = update_data.dict(exclude_unset=True)

    if updated.get("password"):
        updated["password"] = get_password_hash(updated["password"])

    update_model(user, updated)

    db.commit()

    return user


@app.post("/api/users/reset-password")
async def reset_password(request: UserPasswordReset, db=Depends(get_db)):
    """Reset the user's password and send an email notification"""
    user = get_user_by_email(db, request.user_email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found!",
        )

    new_password = make_randomish_string(False, 10)
    user.password = get_password_hash(new_password)

    db.commit()

    celery_app.send_task("app.worker.reset_password", [user.email, new_password])

    return user


@app.post("/api/users/verification_code", response_model=Token)
async def verify_user(request: UserVerification, db=Depends(get_db)):
    """Validate validation code"""

    user = get_user_by_email(db, request.user_email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found!",
        )

    if user.verification_code == request.verification_code:
        user.verification_code = None
        user.active = True
        db.commit()
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username},
        )
        return {"access_token": access_token, "token_type": "bearer"}

    user.verification_code = make_randomish_string()
    user.verification_tries += 1
    db.commit()
    if user.verification_tries <= 3:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
