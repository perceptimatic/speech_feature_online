from os import path


class Settings:
    """App-wide settings"""

    PROJECT_ROOT: str = path.abspath(path.join(path.dirname(__file__), ".."))


settings = Settings()
