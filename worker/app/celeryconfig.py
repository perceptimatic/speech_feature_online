from celery.schedules import crontab

from app.settings import settings

broker_url = "redis://redis:6379/0"

track_started = True

result_serializer = "json"

result_backend = f"db+{settings.POSTGRES_CONNECTION_STRING}"

worker_concurrency = settings.WORKER_CONCURRENCY

beat_schedule = {
    "daily-s3-check": {
        "task": "app.worker.delete_expired_files",
        # daily at midnight UTC
        "schedule": crontab(minute=0, hour=0),
    },
    "dangling-ec2-check": {
        "task": "app.worker.terminate_dangling_nodes",
        # every three hours
        "schedule": crontab(minute=0, hour="*/3"),
    },
}
