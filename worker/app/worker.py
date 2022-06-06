from typing import Any, Dict, List


from jinja2 import Environment, PackageLoader, select_autoescape

from app.analyse import process_data
from app.celery_app import celery_app
from app.emails.smtp_service import SMTPService

jinja_env = Environment(
    loader=PackageLoader("app.emails"), autoescape=select_autoescape()
)


# https://docs.celeryq.dev/en/stable/userguide/tasks.html#on_failure
def on_failure(self, exc, task_id, args, kwargs, einfo):
    pass


@celery_app.task(bind=True, on_failure=on_failure)
def process_shennong_job(
    self, file_paths: List[str], schema: Dict[str, Any], send_email=True
):
    """Run the shennong job."""

    email = schema["email"]
    res_type = schema["res"]
    channel = schema["channel"]
    analysis_settings = schema["analyses"]
    url = process_data(file_paths, analysis_settings, res_type, channel)
    if send_email:
        template = jinja_env.get_template("success.html")
        html = template.render(download_link=url, from_email="example@example.net")
        mailer = SMTPService("Your SFO Results", email, html)
        mailer.send()
    return url
