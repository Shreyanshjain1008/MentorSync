import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.base import Base


class UserRole(StrEnum):
    MENTOR = "mentor"
    STUDENT = "student"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    mentor_sessions: Mapped[list["Session"]] = relationship(
        back_populates="mentor",
        foreign_keys="Session.mentor_id",
    )
    student_sessions: Mapped[list["Session"]] = relationship(
        back_populates="student",
        foreign_keys="Session.student_id",
    )
    sent_messages: Mapped[list["Message"]] = relationship(back_populates="sender")
