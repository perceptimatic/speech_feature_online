import logging
from os import path, mkdir
from uuid import uuid4

import aiofiles
import boto3
from celery import Celery
from fastapi import FastAPI, File, HTTPException, Request, status, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from pydantic.errors import PathNotExistsError
from pydantic.error_wrappers import ErrorWrapper

from app.settings import settings
from app.validators import validate_job_request

# initialise our app
app = FastAPI()

logger = logging.getLogger(__name__)
app.mount("/static", StaticFiles(directory="/code/static/"), name="static")
celery_app = Celery("speech_features", broker="redis://redis:6379/0")

celery_app.conf.task_routes = {
    "app.worker.process_shennong_job": {"queue": settings.PROCESSING_QUEUE},
}


@app.get("/api/temp-creds")
async def get_temp_creds():
    """Fetch temporary S3 creds for uploading a file through the front end"""
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
async def store_shennong_job(request: Request):
    """Create a new job and return."""

    job = await request.json()

    for file in job["files"]:
        if settings.STORAGE_DRIVER == "local" and not path.exists(file):
            raise RequestValidationError(
                [ErrorWrapper(PathNotExistsError(path=file), "/api/shennong-job")]
            )

    validate_job_request(job)

    celery_app.send_task("app.worker.process_shennong_job", [job.pop("files"), job])
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
