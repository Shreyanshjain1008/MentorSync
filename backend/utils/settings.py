from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / '.env'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'MentorSync Backend'
    database_url: str | None = None
    supabase_db_url: str | None = None
    db_ssl_require: bool = True
    supabase_url: str = Field(min_length=1)
    supabase_anon_key: str = Field(min_length=1)
    supabase_timeout_seconds: float = 15.0
    auth_cache_ttl_seconds: float = 60.0
    cors_origins: str = 'http://localhost:3000,http://localhost:5173'
    redis_url: str | None = None

    @property
    def resolved_database_url(self) -> str:
        url = self.supabase_db_url or self.database_url
        if not url:
            raise ValueError('Set SUPABASE_DB_URL or DATABASE_URL in your environment')
        if url.startswith('postgresql+asyncpg://'):
            return url
        if url.startswith('postgresql://'):
            return url.replace('postgresql://', 'postgresql+asyncpg://', 1)
        if url.startswith('postgres://'):
            return url.replace('postgres://', 'postgresql+asyncpg://', 1)
        return url

    @property
    def resolved_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
