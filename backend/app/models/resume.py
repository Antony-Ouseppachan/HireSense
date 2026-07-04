from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database.connection import Base


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    file_id = Column(Text, nullable=False)
    file_url = Column(Text, nullable=False)
    storage_provider = Column(String(30), nullable=False, default="cloudinary")
    original_filename = Column(String(255))
    file_size = Column(BigInteger)
    mime_type = Column(String(100))
    uploaded_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"))

    user = relationship("User", back_populates="resumes", foreign_keys=[user_id])
    analysis = relationship("ResumeAnalysis", back_populates="resume", uselist=False, cascade="all, delete-orphan")


class ResumeAnalysis(Base):
    __tablename__ = "resume_analysis"

    id = Column(BigInteger, primary_key=True)
    resume_id = Column(BigInteger, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, unique=True)
    ats_score = Column(Numeric(5, 2))
    analysis = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())

    resume = relationship("Resume", back_populates="analysis")