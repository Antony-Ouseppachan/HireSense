from sqlalchemy import BigInteger, Boolean, Column, DateTime, String, func
from sqlalchemy.orm import relationship

from app.database.connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True)
    firebase_uid = Column(String(255), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    full_name = Column(String(150), nullable=False)
    role = Column(String(20), nullable=False)
    profile_picture_url = Column(String)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, server_default=func.now())

    profile = relationship("Profile", back_populates="user", uselist=False)
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan", foreign_keys="Resume.user_id")
    interview_sessions = relationship("InterviewSession", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_profile_complete(self) -> bool:
        return self.profile is not None

    @property
    def name(self) -> str:
        return self.full_name