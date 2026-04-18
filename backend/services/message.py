from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.message import Message
from backend.models.user import User
from backend.services.session import SessionService


class MessageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.session_service = SessionService(db)

    async def list_messages(self, current_user: User, session_id: UUID) -> list[Message]:
        await self.session_service.ensure_membership(current_user, session_id)
        result = await self.db.scalars(
            select(Message).where(Message.session_id == session_id).order_by(Message.timestamp.asc())
        )
        return list(result.all())

    async def create_message(self, current_user: User, session_id: UUID, content: str) -> Message:
        await self.session_service.ensure_membership(current_user, session_id)
        message = Message(session_id=session_id, sender_id=current_user.id, message=content)
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return message

