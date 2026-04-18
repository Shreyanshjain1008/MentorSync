from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, dict[UUID, set[WebSocket]]] = defaultdict(lambda: defaultdict(set))

    async def connect(self, channel: str, session_id: UUID, websocket: WebSocket) -> None:
        self.active_connections[channel][session_id].add(websocket)

    def disconnect(self, channel: str, session_id: UUID, websocket: WebSocket) -> None:
        session_connections = self.active_connections[channel][session_id]
        session_connections.discard(websocket)
        if not session_connections:
            self.active_connections[channel].pop(session_id, None)
        if not self.active_connections[channel]:
            self.active_connections.pop(channel, None)

    async def broadcast(self, channel: str, session_id: UUID, payload: dict) -> None:
        stale_connections: list[WebSocket] = []
        for connection in self.active_connections[channel].get(session_id, set()):
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(channel, session_id, connection)


manager = ConnectionManager()
