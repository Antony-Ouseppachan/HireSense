import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.auth_service import create_access_token, create_or_get_user
from ..services.email_service import send_otp_email
from ..services.otp_service import generate_otp, verify_otp

router = APIRouter(prefix="/auth")


class SendOtpPayload(BaseModel):
    email: EmailStr


class VerifyOtpPayload(BaseModel):
    email: EmailStr
    otp: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    is_profile_complete: bool


class VerifyOtpResponse(BaseModel):
    status: Literal["new_user", "existing_user"]
    redirect: Literal["profile", "home"]
    user: UserResponse
    token: str


@router.post("/send-otp")
def send_otp_route(payload: SendOtpPayload):
    normalized_email = payload.email.strip().lower()
    otp = generate_otp(normalized_email)
    try:
        send_otp_email(normalized_email, otp)
    except Exception as exc:
        # If email sending fails, invalidate the generated OTP to avoid stale entries.
        verify_otp(normalized_email, otp)
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {exc}")

    return {"success": True, "message": "OTP has been sent to your email."}


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp_route(payload: VerifyOtpPayload, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    if not verify_otp(normalized_email, payload.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user, _ = create_or_get_user(db, normalized_email)


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp_route(payload: VerifyOtpPayload, db: Session = Depends(get_db)):
    if not verify_otp(payload.email, payload.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user, _ = create_or_get_user(db, payload.email)

    status = "existing_user" if user.is_profile_complete else "new_user"
    redirect = "home" if user.is_profile_complete else "profile"
    token = create_access_token(user)

    return {
        "status": status,
        "redirect": redirect,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_profile_complete": user.is_profile_complete,
        },
        "token": token,
    }
