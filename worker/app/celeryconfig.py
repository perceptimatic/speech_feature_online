from app.settings import settings

broker_url = "redis://redis:6379/0"

track_started = True

result_serializer = "json"

result_backend = f"db+{settings.POSTGRES_CONNECTION_STRING}"

worker_concurrency = settings.WORKER_CONCURRENCY
