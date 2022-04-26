import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.settings import settings


class LocalEmailProvider:
    """Local provider for testing environments"""

    def __init__(self, subject: str, recipient: str, body: str):
        self.recipient = recipient
        self.message = MIMEMultipart("alternative")
        self.message["Subject"] = subject
        self.message["From"] = settings.SENDER_EMAIL
        self.message["To"] = recipient
        contents = MIMEText(body, "html")
        self.message.attach(contents)

    def send(self):
        """send the email"""
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            try:
                server.starttls()
            except Exception as e:
                # for now
                pass

            server.login(settings.SMTP_LOGIN, settings.SMTP_PASSWORD)

            server.sendmail(
                settings.SENDER_EMAIL, self.recipient, self.message.as_string()
            )
