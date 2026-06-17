import random
from typing import Dict


otp_store: Dict[str, str] = {}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def generate_otp(email: str) -> str:
    """Generate and store a random 6-digit one-time password for the given email."""
    normalized_email = _normalize_email(email)
    otp = f"{random.randint(0, 999999):06d}"
    otp_store[normalized_email] = otp
    return otp


def verify_otp(email: str, otp: str) -> bool:
    """Verify a provided OTP and invalidate it after successful verification."""
    normalized_email = _normalize_email(email)
    provided_otp = otp.strip()
    stored_otp = otp_store.get(normalized_email)
    if stored_otp is None or stored_otp != provided_otp:
        return False

    del otp_store[normalized_email]
    return True
