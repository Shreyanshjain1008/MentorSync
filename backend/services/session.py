from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.session import Session, SessionStatus
from backend.models.user import User, UserRole
from backend.schemas.session import SessionCreateRequest


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_sessions(self, current_user: User) -> list[Session]:
        result = await self.db.scalars(
            select(Session)
            .where(or_(Session.mentor_id == current_user.id, Session.student_id == current_user.id))
            .order_by(Session.created_at.desc())
        )
        return list(result.all())

    async def create_session(self, current_user: User, payload: SessionCreateRequest) -> Session:
        if current_user.role != UserRole.MENTOR:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Only mentors can create sessions')

        if payload.student_id:
            student = await self.db.get(User, payload.student_id)
        elif payload.student_email:
            student = await self.db.scalar(select(User).where(User.email == payload.student_email.lower()))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Provide student_id or student_email to create a session',
            )

        if not student or student.role != UserRole.STUDENT:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Student not found')

        session = Session(
            mentor_id=current_user.id,
            student_id=student.id,
            status=SessionStatus.PENDING,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def join_session(self, current_user: User, session_id: UUID) -> Session:
        session = await self._get_authorized_session(current_user, session_id)
        if session.status == SessionStatus.COMPLETED:
            return session

        session.status = SessionStatus.ACTIVE
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def end_session(self, current_user: User, session_id: UUID) -> Session:
        session = await self._get_authorized_session(current_user, session_id)
        if current_user.role != UserRole.MENTOR or session.mentor_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Only the mentor who created this room can end it',
            )
        if session.status == SessionStatus.COMPLETED:
            return session

        session.status = SessionStatus.COMPLETED
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def delete_session(self, current_user: User, session_id: UUID) -> None:
        session = await self._get_authorized_session(current_user, session_id)
        if current_user.role != UserRole.MENTOR or session.mentor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Only the mentor who created this room can delete it')

        await self.db.delete(session)
        await self.db.commit()

    async def ensure_membership(self, current_user: User, session_id: UUID) -> Session:
        return await self._get_authorized_session(current_user, session_id)

    async def _get_authorized_session(self, current_user: User, session_id: UUID) -> Session:
        query = select(Session).where(
            Session.id == session_id,
            or_(Session.mentor_id == current_user.id, Session.student_id == current_user.id),
        )
        session = await self.db.scalar(query)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Session not found')
        return session


