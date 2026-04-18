from dataclasses import dataclass
from time import monotonic
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.session import get_db_session
from backend.models.user import User, UserRole
from backend.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from backend.services.supabase_auth import SupabaseAuthClient
from backend.utils.settings import get_settings

bearer_scheme = HTTPBearer(auto_error=True)
settings = get_settings()


@dataclass(slots=True)
class CachedUserEntry:
    expires_at: float
    user_id: UUID
    email: str
    role: UserRole


_token_user_cache: dict[str, CachedUserEntry] = {}


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.supabase = SupabaseAuthClient()

    async def signup(self, payload: SignupRequest) -> TokenResponse:
        email = payload.email.lower()
        existing_user = await self.db.scalar(select(User).where(User.email == email))
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail='An account with this email already exists. Please log in instead.',
            )

        response = await self.supabase.sign_up(email, payload.password, payload.role.value)
        session = response.get('session') or {}
        access_token = session.get('access_token') or response.get('access_token')
        refresh_token = session.get('refresh_token') or response.get('refresh_token')

        supabase_user = response.get('user') or session.get('user')
        if not supabase_user and access_token:
            supabase_user = await self.supabase.get_user(access_token)
        if not supabase_user and {'id', 'email'}.issubset(response.keys()):
            supabase_user = response
        if not supabase_user:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail='Supabase signup succeeded, but no user payload was returned.',
            )

        if not access_token:
            access_token, refresh_token, supabase_user = await self._auto_confirm_and_sign_in(
                email,
                payload.password,
                supabase_user,
            )

        user = await self._sync_local_user(supabase_user, fallback_role=payload.role)
        if access_token:
            self._cache_authenticated_user(access_token, user)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )

    async def login(self, payload: LoginRequest) -> TokenResponse:
        email = payload.email.lower()
        access_token, refresh_token, supabase_user = await self._login_with_auto_confirm(email, payload.password)

        user = await self._sync_local_user(supabase_user)
        if access_token:
            self._cache_authenticated_user(access_token, user)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )

    async def get_current_user_from_token(self, token: str) -> User:
        cached_user = self._get_cached_user(token)
        if cached_user:
            return cached_user

        supabase_user = await self.supabase.get_user(token)
        user = await self._sync_local_user(supabase_user)
        self._cache_authenticated_user(token, user)
        return user

    async def _login_with_auto_confirm(self, email: str, password: str) -> tuple[str | None, str | None, dict]:
        try:
            response = await self.supabase.sign_in_with_password(email, password)
        except HTTPException as exc:
            auth_user = await self._get_auth_user_by_email(email)
            if exc.status_code not in {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED} or not auth_user:
                raise

            if not auth_user['is_confirmed']:
                await self._auto_confirm_supabase_user(auth_user['id'])
                response = await self.supabase.sign_in_with_password(email, password)
            else:
                raise

        return await self._extract_session_payload(response)

    async def _auto_confirm_and_sign_in(
        self,
        email: str,
        password: str,
        supabase_user: dict,
    ) -> tuple[str | None, str | None, dict]:
        user_id = self._parse_supabase_user_id(supabase_user)
        await self._auto_confirm_supabase_user(user_id)
        response = await self.supabase.sign_in_with_password(email, password)
        return await self._extract_session_payload(response)

    async def _extract_session_payload(self, response: dict) -> tuple[str | None, str | None, dict]:
        session = response.get('session') or {}
        access_token = response.get('access_token') or session.get('access_token')
        refresh_token = response.get('refresh_token') or session.get('refresh_token')

        supabase_user = response.get('user') or session.get('user')
        if not supabase_user and access_token:
            supabase_user = await self.supabase.get_user(access_token)
        if not supabase_user and {'id', 'email'}.issubset(response.keys()):
            supabase_user = response
        if not supabase_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

        return access_token, refresh_token, supabase_user

    async def _get_auth_user_by_email(self, email: str) -> dict | None:
        result = await self.db.execute(
            text(
                '''
                select id, email_confirmed_at is not null as is_confirmed
                from auth.users
                where lower(email) = :email
                limit 1
                '''
            ),
            {'email': email},
        )
        row = result.mappings().first()
        if not row:
            return None

        return {
            'id': UUID(str(row['id'])),
            'is_confirmed': bool(row['is_confirmed']),
        }

    async def _auto_confirm_supabase_user(self, user_id: UUID) -> None:
        await self.db.execute(
            text(
                '''
                update auth.users
                set email_confirmed_at = coalesce(email_confirmed_at, now())
                where id = :user_id
                '''
            ),
            {'user_id': user_id},
        )
        await self.db.commit()

    def _parse_supabase_user_id(self, supabase_user: dict) -> UUID:
        try:
            return UUID(supabase_user['id'])
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid Supabase user payload') from exc

    async def _sync_local_user(self, supabase_user: dict, fallback_role: UserRole | None = None) -> User:
        user_id = self._parse_supabase_user_id(supabase_user)

        email = (supabase_user.get('email') or '').lower()
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Supabase user email is missing')

        existing_user = await self.db.get(User, user_id)
        existing_user_by_email = existing_user
        if existing_user_by_email is None:
            existing_user_by_email = await self.db.scalar(select(User).where(User.email == email))
        role = self._resolve_role(supabase_user, existing_user or existing_user_by_email, fallback_role)

        if existing_user:
            existing_user.email = email
            existing_user.role = role
            existing_user.password_hash = None
            await self.db.commit()
            await self.db.refresh(existing_user)
            return existing_user

        if existing_user_by_email:
            existing_user_by_email.role = role
            existing_user_by_email.password_hash = None
            await self.db.commit()
            await self.db.refresh(existing_user_by_email)
            return existing_user_by_email

        user = User(
            id=user_id,
            email=email,
            role=role,
            password_hash=None,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    def _resolve_role(
        self,
        supabase_user: dict,
        existing_user: User | None,
        fallback_role: UserRole | None,
    ) -> UserRole:
        metadata = supabase_user.get('user_metadata') or {}
        app_metadata = supabase_user.get('app_metadata') or {}
        role_value = metadata.get('role') or app_metadata.get('role')

        if role_value:
            try:
                return UserRole(role_value)
            except ValueError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid user role in Supabase metadata') from exc

        if existing_user:
            return existing_user.role
        if fallback_role:
            return fallback_role

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='User role is missing. Sign up again or set role metadata in Supabase Auth.',
        )

    def _cache_authenticated_user(self, token: str, user: User) -> None:
        _token_user_cache[token] = CachedUserEntry(
            expires_at=monotonic() + settings.auth_cache_ttl_seconds,
            user_id=user.id,
            email=user.email,
            role=user.role,
        )

    def _get_cached_user(self, token: str) -> User | None:
        cached_entry = _token_user_cache.get(token)
        if not cached_entry:
            return None

        if cached_entry.expires_at <= monotonic():
            _token_user_cache.pop(token, None)
            return None

        return User(
            id=cached_entry.user_id,
            email=cached_entry.email,
            role=cached_entry.role,
            password_hash=None,
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    return await AuthService(db).get_current_user_from_token(credentials.credentials)
