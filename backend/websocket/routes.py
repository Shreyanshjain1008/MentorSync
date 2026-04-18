from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from backend.database.session import AsyncSessionLocal
from backend.schemas.websocket import ChatEvent, CodeSyncEvent, SignalingEvent
from backend.services.collaboration import CollaborationService
from backend.services.redis_pubsub import RedisEventPublisher
from backend.websocket.dependencies import get_websocket_user
from backend.websocket.manager import manager

websocket_router = APIRouter()
redis_publisher = RedisEventPublisher()
DISCONNECT_ERRORS = (WebSocketDisconnect, ConnectionResetError, OSError, RuntimeError)


async def _authorize(websocket: WebSocket, session_id: UUID):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return None

    async with AsyncSessionLocal() as db:
        try:
            user = await get_websocket_user(token, db)
            service = CollaborationService(db)
            await service.validate_session_access(session_id, user)
            return user
        except Exception as exc:
            reason = getattr(exc, "reason", None) or getattr(exc, "detail", None) or "Unauthorized websocket access"
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(reason))
            return None


@websocket_router.websocket("/ws/chat/{session_id}")
async def chat_socket(websocket: WebSocket, session_id: UUID) -> None:
    await websocket.accept()
    user = await _authorize(websocket, session_id)
    if not user:
        return

    await manager.connect("chat", session_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            content = str(data.get("message", "")).strip()
            if not content:
                continue

            async with AsyncSessionLocal() as db:
                service = CollaborationService(db)
                saved_message = await service.save_chat_message(session_id, user.id, content)

            event = ChatEvent(
                id=saved_message.id,
                session_id=session_id,
                sender_id=user.id,
                message=saved_message.message,
                timestamp=saved_message.timestamp,
            ).model_dump(mode="json")
            await manager.broadcast("chat", session_id, event)
            await redis_publisher.publish(f"chat:{session_id}", event)
    except DISCONNECT_ERRORS:
        manager.disconnect("chat", session_id, websocket)


@websocket_router.websocket("/ws/code/{session_id}")
async def code_socket(websocket: WebSocket, session_id: UUID) -> None:
    await websocket.accept()
    user = await _authorize(websocket, session_id)
    if not user:
        return

    await manager.connect("code", session_id, websocket)

    async with AsyncSessionLocal() as db:
        service = CollaborationService(db)
        snapshot = await service.get_code_snapshot(session_id)

    if snapshot:
        await websocket.send_json(
            CodeSyncEvent(
                session_id=session_id,
                sender_id=user.id,
                client_id=None,
                code=snapshot.code,
                cursor_position=None,
                updated_at=snapshot.updated_at or datetime.now(timezone.utc),
            ).model_dump(mode="json")
        )

    try:
        while True:
            data = await websocket.receive_json()
            code = str(data.get("code", ""))
            cursor_position = data.get("cursor_position")
            client_id = data.get("client_id")

            async with AsyncSessionLocal() as db:
                service = CollaborationService(db)
                snapshot = await service.save_code_snapshot(session_id, code)

            event = CodeSyncEvent(
                session_id=session_id,
                sender_id=user.id,
                client_id=str(client_id) if client_id else None,
                code=snapshot.code,
                cursor_position=cursor_position,
                updated_at=snapshot.updated_at or datetime.now(timezone.utc),
            ).model_dump(mode="json")
            await manager.broadcast("code", session_id, event)
            await redis_publisher.publish(f"code:{session_id}", event)
    except DISCONNECT_ERRORS:
        manager.disconnect("code", session_id, websocket)


@websocket_router.websocket("/ws/signaling/{session_id}")
async def signaling_socket(websocket: WebSocket, session_id: UUID) -> None:
    await websocket.accept()
    user = await _authorize(websocket, session_id)
    if not user:
        return

    await manager.connect("signaling", session_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            event = SignalingEvent(
                session_id=session_id,
                sender_id=user.id,
                signal_type=str(data.get("signal_type", "unknown")),
                payload=data.get("payload", {}),
                timestamp=datetime.now(timezone.utc),
            ).model_dump(mode="json")
            await manager.broadcast("signaling", session_id, event)
            await redis_publisher.publish(f"signaling:{session_id}", event)
    except DISCONNECT_ERRORS:
        manager.disconnect("signaling", session_id, websocket)

