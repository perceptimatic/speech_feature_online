from app.settings import settings

#    Initialize debugger.
#    Note that attempting to run another process (like a script), will raise a RuntimeError, which we swallow.

if settings.WORKER_DEBUG:
    import debugpy

    try:
        debugpy.listen(("0.0.0.0", 5678))
    except RuntimeError:
        pass
