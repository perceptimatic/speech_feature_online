import logging
import random
import string
from os import path
from typing import List

import boto3
from celery import Celery, signature
from celery.backends.database import Task
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError

from app.models import UserTask
from app.schemas import (
    LoginRequest,
    Token,
    User,
    UserIn,
    UserTaskOut,
    UserVerification,
)
from app.settings import settings
from app.util import (
    authenticate_user,
    create_access_token,
    create_user,
    get_db,
    get_current_user,
    get_user_by_email,
)
from app.validators import raise_422, validate_job_request, ValidationViolation

# initialise our app
app = FastAPI()


logger = logging.getLogger(__name__)
app.mount(
    "/static",
    StaticFiles(directory=path.join(settings.PROJECT_ROOT, "static")),
    name="static",
)

celery_app = Celery("speech_features", broker="redis://redis:6379/0")

celery_app.conf.task_routes = {
    "app.worker.process_shennong_job": {"queue": settings.PROCESSING_QUEUE},
    "app.worker.test": {"queue": settings.PROCESSING_QUEUE},
    "app.worker.verify_user_email": {"queue": settings.NOTIFICATION_QUEUE},
}


def make_verification_code():
    """Randomish string for verification"""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


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
        [job],
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


@app.get("/api/users/current/", response_model=User)
async def fetch_current_user(current_user: User = Depends(get_current_user)):
    """Return the current user"""
    return current_user


@app.get("/api/users/{user_id}/tasks", response_model=List[UserTaskOut])
async def fetch_user_tasks(
    user_id: int, current_user: User = Depends(get_current_user), db=Depends(get_db)
):
    """Return the current user"""
    # user must be admin or the current user must have the same id
    if (current_user.id != user_id) and not current_user.has_role("admin"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user = (
        current_user
        if current_user.id == user_id
        else db.query(User).filter(User.id == user_id).one()
    )

    # if no job has been run yet, celery's task tables won't exist, in which case we'll bail with an empty result
    try:
        db.query(Task).count()
    except ProgrammingError:
        return []

    user_tasks = user.load_tasks(db)

    # poor man's eager load -- grab all foreign keys, then do an in statement and bind
    tasks = {
        task.task_id: task
        for task in db.query(Task)
        .filter(Task.task_id.in_([task.taskmeta_id for task in user_tasks]))
        .all()
    }

    for u_t in user_tasks:
        if tasks.get(u_t.taskmeta_id):
            u_t.task_info = tasks[u_t.taskmeta_id]

    return user_tasks


@app.post("/api/users", response_model=User)
async def post_user(request: UserIn, db=Depends(get_db)):
    """Create a new user"""
    existing = get_user_by_email(db, request.email)
    if existing:
        raise_422([ValidationViolation(field="email", message="Email already taken!")])

    verification_code = make_verification_code()

    user = await create_user(db, request, verification_code)

    celery_app.send_task(
        "app.worker.verify_user_email", [user.email, verification_code]
    )

    return user


@app.post("/api/users/{user_email}/verification_code", response_model=Token)
async def verify_user(user_email: str, request: UserVerification, db=Depends(get_db)):
    """Verify validation code and"""

    user = get_user_by_email(db, user_email)

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

    user.verification_code = make_verification_code()
    user.verification_tries += 1
    db.commit()
    if user.verification_tries <= 3:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
