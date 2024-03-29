from os import getenv, path


class Settings:
    """App-wide settings"""

    BUCKET_NAME: str = getenv("BUCKET_NAME")
    LAUNCH_TEMPLATE_ID: str = getenv("LAUNCH_TEMPLATE_ID")
    POSTGRES_CONNECTION_STRING: str = f"postgresql://{getenv('POSTGRES_USER')}:{getenv('POSTGRES_PASSWORD')}@postgres/{getenv('POSTGRES_DB')}"
    PROCESSING_QUEUE: str = getenv("PROCESSING_QUEUE")
    FILE_EXPIRATION_DAYS: int = int(getenv("FILE_EXPIRATION_DAYS", 7))
    GITHUB_PAT: str = getenv("GITHUB_PAT")
    GITHUB_OWNER: str = getenv("GITHUB_OWNER")
    NOTIFICATION_QUEUE: str = getenv("NOTIFICATION_QUEUE")
    SENDER_EMAIL: str = getenv("SENDER_EMAIL")
    SMTP_HOST: str = getenv("SMTP_HOST")
    SMTP_PORT: str = getenv("SMTP_PORT")
    SMTP_LOGIN: str = getenv("SMTP_LOGIN")
    SMTP_PASSWORD: str = getenv("SMTP_PASSWORD")
    WORKER_CONCURRENCY: int = int(getenv("WORKER_CONCURRENCY", 1))
    WORKER_DEBUG: bool = getenv("WORKER_DEBUG") == "true"


settings = Settings()
