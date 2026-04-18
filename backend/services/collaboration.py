from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.code_snapshot import CodeSnapshot
from backend.models.message import Message
from backend.models.session import Session
from backend.models.user import User


class CollaborationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def validate_session_access(self, session_id: UUID, user: User) -> Session:
        session = await self.db.get(Session, session_id)
        if not session or user.id not in {session.mentor_id, session.student_id}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session access denied")
        return session

    async def get_code_snapshot(self, session_id: UUID) -> CodeSnapshot | None:
        return await self.db.scalar(select(CodeSnapshot).where(CodeSnapshot.session_id == session_id))

    async def save_chat_message(self, session_id: UUID, sender_id: UUID, content: str) -> Message:
        message = Message(session_id=session_id, sender_id=sender_id, message=content)
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def save_code_snapshot(self, session_id: UUID, code: str) -> CodeSnapshot:
        snapshot = await self.db.scalar(select(CodeSnapshot).where(CodeSnapshot.session_id == session_id))
        if snapshot:
            if snapshot.code == code:
                return snapshot
            snapshot.code = code
            snapshot.updated_at = datetime.now(timezone.utc)
        else:
            snapshot = CodeSnapshot(session_id=session_id, code=code)
            self.db.add(snapshot)
        await self.db.commit()
        await self.db.refresh(snapshot)
        return snapshot
