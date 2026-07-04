from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.auth_service import create_access_token, create_or_get_user

router = APIRouter(prefix="/auth")


class FirebaseLoginPayload(BaseModel):
    email: EmailStr
    name: str | None = None


@router.post("/firebase-login")
def firebase_login_route(payload: FirebaseLoginPayload, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    user, is_new = create_or_get_user(db, normalized_email)

    if payload.name and not user.name:
        user.name = payload.name
        db.commit()
        db.refresh(user)

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
            "name": user.name or user.email.split("@")[0]
        },
        "token": token,
    }