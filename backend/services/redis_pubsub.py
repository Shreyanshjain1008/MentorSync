import json
import logging

from redis.asyncio import Redis

from backend.utils.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RedisEventPublisher:
    def __init__(self) -> None:
        self.client: Redis | None = Redis.from_url(settings.redis_url) if settings.redis_url else None
        self.disabled = False

    async def publish(self, channel: str, payload: dict) -> None:
        if not self.client or self.disabled:
            return
        try:
            await self.client.publish(channel, json.dumps(payload, default=str))
        except Exception as exc:
            self.disabled = True
            logger.warning(
                'Redis publish disabled after connection failure for channel %s: %s. '
                'Set REDIS_URL only when Redis is running.',
                channel,
                str(exc),
            )
