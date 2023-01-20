import logging
from logging.handlers import TimedRotatingFileHandler
from os import path

from app.settings import settings

# Initialize logger.

file_handler = TimedRotatingFileHandler(
    path.join(path.dirname(__file__), "logs", "errors.log"),
    when="D",
    backupCount=14,
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

#    Initialize debugger.
#    Note that hot reloading creates a new server process and will detach debugger if active.
#    Loading the app a second time while the server is running (e.g., alembic)
#    will call this line again and raise address conflict, which we swallow
if settings.FAST_API_DEBUG:
    import debugpy

    try:
        debugpy.listen(("0.0.0.0", 5678))
    except RuntimeError:
        pass
