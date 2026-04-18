from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.session import get_db_session
from backend.models.user import User
from backend.schemas.session import CodeSnapshotRequest, CodeSnapshotResponse, SessionCreateRequest, SessionResponse
from backend.services.auth import get_current_user
from backend.services.collaboration import CollaborationService
from backend.services.session import SessionService

router = APIRouter()


@router.get('', response_model=list[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[SessionResponse]:
    return await SessionService(db).list_sessions(current_user)


@router.get('/{session_id}', response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SessionResponse:
    return await SessionService(db).ensure_membership(current_user, session_id)


@router.post('/create', response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SessionResponse:
    return await SessionService(db).create_session(current_user, payload)


@router.post('/join/{session_id}', response_model=SessionResponse)
async def join_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SessionResponse:
    return await SessionService(db).join_session(current_user, session_id)


@router.post('/end/{session_id}', response_model=SessionResponse)
async def end_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SessionResponse:
    return await SessionService(db).end_session(current_user, session_id)


@router.delete('/{session_id}', status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await SessionService(db).delete_session(current_user, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/{session_id}/code', response_model=CodeSnapshotResponse | None)
async def get_code_snapshot(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> CodeSnapshotResponse | None:
    service = CollaborationService(db)
    await service.validate_session_access(session_id, current_user)
    snapshot = await service.get_code_snapshot(session_id)
    if not snapshot:
        return None
    return CodeSnapshotResponse(code=snapshot.code, updated_at=snapshot.updated_at)


@router.post('/{session_id}/code', response_model=CodeSnapshotResponse)
async def save_code_snapshot(
    session_id: UUID,
    payload: CodeSnapshotRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> CodeSnapshotResponse:
    service = CollaborationService(db)
    await service.validate_session_access(session_id, current_user)
    snapshot = await service.save_code_snapshot(session_id, payload.code)
    return CodeSnapshotResponse(code=snapshot.code, updated_at=snapshot.updated_at)

