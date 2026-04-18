import asyncio

from backend.database.base import Base
from backend.database.session import engine


async def main() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    print('Database tables are ready.')


if __name__ == '__main__':
    asyncio.run(main())
