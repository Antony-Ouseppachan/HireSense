from sqlalchemy import BigInteger, Column, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.database.connection import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
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