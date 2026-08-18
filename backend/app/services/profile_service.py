from sqlalchemy.orm import Session

from app.models.profile import Profile as ProfileModel
from app.models.user import User


def get_profile_by_user_id(db: Session, user_id):
    return db.query(ProfileModel).filter(ProfileModel.user_id == user_id).first()


def create_or_update_profile(db: Session, user: User, profile_data):
    profile = get_profile_by_user_id(db, user.id)
    if profile is None:
        profile = ProfileModel(user_id=user.id, **profile_data)
        db.add(profile)
    else:
        for field, value in profile_data.items():
            setattr(profile, field, value)

    user.is_profile_complete = True
    db.commit()
    db.refresh(profile)
    db.refresh(user)
    return profile
