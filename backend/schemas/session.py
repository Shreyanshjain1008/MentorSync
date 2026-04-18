from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from backend.models.session import SessionStatus


class SessionCreateRequest(BaseModel):
    student_id: UUID | None = None
    student_email: EmailStr | None = None


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    mentor_id: UUID
    student_id: UUID
    status: SessionStatus
    created_at: datetime


class CodeSnapshotRequest(BaseModel):
    code: str


class CodeSnapshotResponse(BaseModel):
    code: str
    updated_at: datetime


class CodeSnapshotRequest(BaseModel):
    code: str


class CodeSnapshotResponse(BaseModel):
    code: str
    updated_at: datetime

