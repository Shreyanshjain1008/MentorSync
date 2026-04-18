from uuid import UUID

from fastapi import status
from fastapi.exceptions import WebSocketException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.auth import AuthService


async def get_websocket_user(token: str, db: AsyncSession):
    try:
        return await AuthService(db).get_current_user_from_token(token)
    except Exception as exc:
        message = getattr(exc, "detail", "Invalid token")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=str(message)) from exc
