from os import getenv, path


class Settings:
    """App-wide settings"""

    ACCESS_TOKEN_EXPIRE_MINUTES: int = (
        int(getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
        if getenv("ACCESS_TOKEN_EXPIRE_MINUTES")
        else 90
    )
    APP_ENV: str = getenv("APP_ENV")
    BUCKET_NAME: str = getenv("BUCKET_NAME")
    EMAIL_ALLOWLIST = getenv("EMAIL_ALLOWLIST")
    FAST_API_DEBUG: bool = getenv("FAST_API_DEBUG") == "true"
    FAST_API_DEFAULT_ADMIN_PASSWORD: str = getenv("FAST_API_DEFAULT_ADMIN_PASSWORD")
    JWT_ALGO: str = "HS256"
    JWT_SECRET: str = getenv("JWT_SECRET")
    NOTIFICATION_QUEUE: str = getenv("NOTIFICATION_QUEUE")
    PROCESSING_QUEUE: str = getenv("PROCESSING_QUEUE")
    PROJECT_ROOT: str = path.abspath(path.join(path.dirname(__file__), ".."))
    POSTGRES_CONNECTION_STRING: str = f"postgresql://{getenv('POSTGRES_USER')}:{getenv('POSTGRES_PASSWORD')}@postgres/{getenv('POSTGRES_DB')}"


settings = Settings()
