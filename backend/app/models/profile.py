import uuid

from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.connection import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    name = Column(String(255))
    education = Column(Text)
    skills = Column(Text)
    experience = Column(Text)
    projects = Column(Text)
    target_role = Column(String(255))

    user = relationship("User", back_populates="profile")

    @property
    def role(self):
        return self.target_role
