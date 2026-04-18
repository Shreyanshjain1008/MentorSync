from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatEvent(BaseModel):
    type: str = "chat_message"
    id: UUID
    session_id: UUID
    sender_id: UUID
    message: str = Field(min_length=1, max_length=5000)
    timestamp: datetime


class CodeSyncEvent(BaseModel):
    type: str = "code_sync"
    session_id: UUID
    sender_id: UUID
    client_id: str | None = None
    code: str
    cursor_position: int | None = None
    updated_at: datetime


class SignalingEvent(BaseModel):
    type: str = "signal"
    session_id: UUID
    sender_id: UUID
    signal_type: str
    payload: dict
    timestamp: datetime

