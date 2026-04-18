from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.utils.settings import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.resolved_database_url,
    echo=False,
    future=True,
    connect_args={"ssl": "require"} if settings.db_ssl_require else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
