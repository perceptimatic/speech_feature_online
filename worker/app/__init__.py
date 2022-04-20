import logging
from logging.handlers import TimedRotatingFileHandler
from os import path

from app.settings import settings

# Initialize logger.

file_handler = TimedRotatingFileHandler(
    path.join(path.dirname(__file__), "logs", "errors.log"),
    when="D",
    backupCount=10,
    interval=1,
)
file_handler.setLevel(logging.ERROR)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s: %(message)s",
    handlers=[file_handler, console_handler],
)
