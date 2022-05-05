from typing import Any, Dict, List

from jinja2 import Environment, PackageLoader, select_autoescape


from app.analyse import process_data
from app.celery_app import celery_app
from app.email.smtp_service import SMTPService

env = Environment(loader=PackageLoader("app.email"), autoescape=select_autoescape())


@celery_app.task()
def process_shennong_job(file_paths: List[str], data: Dict[str, Any]):
    """Run the shennong job."""

    email = data["email"]
    res_type = data["res"]
    channel = data["channel"]
    settings = data["analyses"]
    url = process_data(file_paths, settings, res_type, channel)
    template = env.get_template("success.html")
    html = template.render(download_link=url, from_email="example@example.net")
    mailer = SMTPService("Your SFO Results", email, html)
    mailer.send()
    return url
