import logging
from os import path, mkdir
from uuid import uuid4

import aiofiles
import boto3
from celery import Celery
from fastapi import Body, FastAPI, File, HTTPException, status, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from pydantic.errors import PathNotExistsError
from pydantic.error_wrappers import ErrorWrapper

from app.settings import settings
from app.schemas import JobIn

# initialise our app
app = FastAPI()

if settings.STORAGE_DRIVER == "local":
    app.mount("/static", StaticFiles(directory="/code/static/"), name="static")

logger = logging.getLogger(__name__)

celery_app = Celery("speech_features", broker="redis://redis:6379/0")

celery_app.conf.task_routes = {
    "app.worker.process_shennong_job": {"queue": settings.PROCESSING_QUEUE},
}


@app.get("/api/temp-creds")
async def get_temp_creds():
    if settings.STORAGE_DRIVER != "s3":
        raise HTTPException(
            status_code=400, detail="Application not configured for this storage driver"
        )

    client = boto3.client("sts")
    response = client.get_session_token(
        DurationSeconds=900,
    )
    return response


@app.post("/api/shennong-job", response_model=bool, status_code=status.HTTP_201_CREATED)
async def store_shennong_job(
    job: JobIn,
):
    """Create a new job and return."""

    for file in job.files:
        if settings.STORAGE_DRIVER == "local" and not path.exists(file):
            raise RequestValidationError(
                [ErrorWrapper(PathNotExistsError(path=file), "/api/shennong-job")]
            )

    celery_app.send_task("app.worker.process_shennong_job", [job.files, job.dict()])
    return True


@app.post("/api/file", status_code=status.HTTP_201_CREATED)
async def post_file(upload: UploadFile = File(...)):
    """Save temporary file and return url for inclusion in metadata request"""

    if settings.STORAGE_DRIVER != "local":
        raise HTTPException(
            status_code=400, detail="Application not configured for this storage driver"
        )

    filename = None

    save_dir = path.join(settings.UPLOAD_DIR, uuid4().hex)

    mkdir(save_dir)

    save_path = path.join(save_dir, upload.filename)

    async with aiofiles.open(save_path, "wb") as f:
        filename = f.name
        while content := await upload.read(1024):
            await f.write(content)
    return {"contentUrl": filename}
