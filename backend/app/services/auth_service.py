import os
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User

JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "your_jwt_secret"))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 12


def get_user_by_email(db: Session, email: str):
    normalized_email = email.lower().strip()
    return db.query(User).filter(User.email == normalized_email).first()


def create_or_get_user(db: Session, email: str):
    normalized_email = email.lower().strip()
    existing_user = get_user_by_email(db, normalized_email)
    if existing_user:
        return existing_user, False

    user = User(email=normalized_email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True


def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="OTP token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def get_current_user(db: Session = Depends(get_db), authorization: str | None = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
