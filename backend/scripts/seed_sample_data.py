import asyncio
from uuid import uuid4

from sqlalchemy import select

from backend.database.session import AsyncSessionLocal
from backend.models.message import Message
from backend.models.session import Session, SessionStatus
from backend.models.user import User, UserRole

MENTOR_EMAIL = 'mentor.seed@mentorsync.dev'
STUDENT_EMAIL = 'student.seed@mentorsync.dev'


async def main() -> None:
    async with AsyncSessionLocal() as db:
        mentor = await db.scalar(select(User).where(User.email == MENTOR_EMAIL))
        if not mentor:
            mentor = User(id=uuid4(), email=MENTOR_EMAIL, role=UserRole.MENTOR, password_hash=None)
            db.add(mentor)

        student = await db.scalar(select(User).where(User.email == STUDENT_EMAIL))
        if not student:
            student = User(id=uuid4(), email=STUDENT_EMAIL, role=UserRole.STUDENT, password_hash=None)
            db.add(student)

        await db.commit()
        await db.refresh(mentor)
        await db.refresh(student)

        session = await db.scalar(
            select(Session).where(Session.mentor_id == mentor.id, Session.student_id == student.id)
        )
        if not session:
            session = Session(
                mentor_id=mentor.id,
                student_id=student.id,
                status=SessionStatus.ACTIVE,
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

            db.add_all(
                [
                    Message(session_id=session.id, sender_id=mentor.id, message='Welcome to MentorSync.'),
                    Message(session_id=session.id, sender_id=student.id, message='Ready to review the solution!'),
                ]
            )
            await db.commit()

        print('Seed complete:')
        print(f'  Mentor email : {mentor.email}')
        print(f'  Student email: {student.email}')
        print(f'  Session ID   : {session.id}')


if __name__ == '__main__':
    asyncio.run(main())
