from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database.base import Base
from backend.database.session import engine
from backend.routers import auth, messages, sessions
from backend.services.supabase_auth import SupabaseAuthClient
from backend.utils.exceptions import register_exception_handlers
from backend.utils.settings import get_settings
from backend.websocket.routes import websocket_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    try:
        yield
    finally:
        await SupabaseAuthClient.close_shared_client()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version='1.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.resolved_cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

register_exception_handlers(app)

app.include_router(auth.router, prefix='/auth', tags=['auth'])
app.include_router(sessions.router, prefix='/sessions', tags=['sessions'])
app.include_router(messages.router, prefix='/messages', tags=['messages'])
app.include_router(websocket_router, tags=['websocket'])


@app.get('/', tags=['root'])
async def root() -> dict[str, str]:
    return {'message': 'MentorSync backend is running', 'docs': '/docs', 'health': '/health'}


@app.get('/health', tags=['health'])
async def health_check() -> dict[str, str]:
    return {'status': 'ok'}
