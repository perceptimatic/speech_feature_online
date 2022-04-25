from os import getenv


class Settings:
    """App-wide settings"""

    APP_ENV: str = getenv("APP_ENV")
    EMAIL_ALLOWLIST = getenv("EMAIL_ALLOWLIST")
    FAST_API_DEBUG: bool = getenv("FAST_API_DEBUG") == "true"
    FAST_API_DEFAULT_ADMIN_PASSWORD: str = getenv("FAST_API_DEFAULT_ADMIN_PASSWORD")
    JWT_ALGO: str = "HS256"
    JWT_SECRET: str = getenv("JWT_SECRET")
    PROCESSING_QUEUE: str = getenv("PROCESSING_QUEUE")
    STORAGE_DRIVER: str = getenv("STORAGE_DRIVER")
    UPLOAD_DIR: str = getenv("UPLOAD_DIR")
    POSTGRES_CONNECTION_STRING: str = f"postgresql://{getenv('POSTGRES_USER')}:{getenv('POSTGRES_PASSWORD')}@postgres/{getenv('POSTGRES_DB')}"


settings = Settings()
