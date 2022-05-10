from os import getenv


class Settings:
    """App-wide settings"""

    BUCKET_NAME: str = getenv("BUCKET_NAME")
    POSTGRES_CONNECTION_STRING: str = f"postgresql://{getenv('POSTGRES_USER')}:{getenv('POSTGRES_PASSWORD')}@postgres/{getenv('POSTGRES_DB')}"
    PROCESSING_QUEUE: str = getenv("PROCESSING_QUEUE")
    STORAGE_DRIVER: str = getenv("STORAGE_DRIVER")
    SENDER_EMAIL: str = getenv("SENDER_EMAIL")
    SMTP_HOST: str = getenv("SMTP_HOST")
    SMTP_PORT: str = getenv("SMTP_PORT")
    SMTP_LOGIN: str = getenv("SMTP_LOGIN")
    SMTP_PASSWORD: str = getenv("SMTP_PASSWORD")
    STATIC_ASSET_URL: str = getenv("STATIC_ASSET_URL")
    WORKER_DEBUG: bool = getenv("WORKER_DEBUG") == "true"
    UPLOAD_DIR: str = getenv("UPLOAD_DIR")


settings = Settings()
