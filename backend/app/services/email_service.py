import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))

EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 465))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

if not EMAIL_USER or not EMAIL_PASS:
    raise RuntimeError("EMAIL_USER and EMAIL_PASS must be set in backend/.env")


def send_email(subject: str, recipient: str, body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = EMAIL_USER
    message["To"] = recipient
    message.set_content(body)

    if EMAIL_PORT == 465:
        with smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT) as smtp:
            smtp.login(EMAIL_USER, EMAIL_PASS)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(EMAIL_USER, EMAIL_PASS)
            smtp.send_message(message)


def send_otp_email(email: str, otp: str) -> None:
    subject = "Your HireSense Login OTP"
    body = (
        f"Hello,\n\nYour HireSense one-time login code is: {otp}\n\n"
        "Enter this code to sign in. This OTP is valid for a single use only.\n\n"
        "If you did not request this code, please ignore this email.\n\n"
        "Thanks,\nHireSense Team"
    )
    send_email(subject, email, body)
