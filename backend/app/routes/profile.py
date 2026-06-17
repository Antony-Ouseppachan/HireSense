from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.auth_service import get_current_user
from ..services.profile_service import create_or_update_profile, get_profile_by_user_id

router = APIRouter()


class ProfilePayload(BaseModel):
    name: Optional[str] = None
    education: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    projects: Optional[str] = None
    role: Optional[str] = None


class ProfileResponse(BaseModel):
    id: str
    user_id: str
    name: Optional[str] = None
    education: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    projects: Optional[str] = None
    role: Optional[str] = None

    model_config = {"from_attributes": True}


@router.post("/profile", response_model=ProfileResponse)
def save_profile_route(
    profile: ProfilePayload,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile_data = profile.dict(exclude_none=True)
    if "role" in profile_data:
        profile_data["target_role"] = profile_data.pop("role")

    saved_profile = create_or_update_profile(db, current_user, profile_data)
    return saved_profile


@router.get("/profile", response_model=ProfileResponse)
def get_profile_route(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    profile = get_profile_by_user_id(db, current_user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile
