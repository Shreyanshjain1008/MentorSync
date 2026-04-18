from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.session import get_db_session
from backend.models.user import User
from backend.schemas.message import MessageCreateRequest, MessageResponse
from backend.services.auth import get_current_user
from backend.services.message import MessageService

router = APIRouter()


@router.get("/{session_id}", response_model=list[MessageResponse])
async def list_messages(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[MessageResponse]:
    return await MessageService(db).list_messages(current_user, session_id)


@router.post("/{session_id}", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    session_id: UUID,
    payload: MessageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    return await MessageService(db).create_message(current_user, session_id, payload.message)

