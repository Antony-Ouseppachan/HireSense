import uuid

from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database.connection import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, unique=True)
    technical_score = Column(Integer)
    communication_score = Column(Integer)
    confidence_score = Column(Integer)
    overall_score = Column(Integer)
    report_json = Column(JSONB)

    session = relationship("InterviewSession", back_populates="report")