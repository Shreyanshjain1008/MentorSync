import httpx
from fastapi import HTTPException, status

from backend.utils.settings import get_settings

settings = get_settings()


class SupabaseAuthClient:
    _shared_client: httpx.AsyncClient | None = None

    def __init__(self) -> None:
        self.base_url = settings.supabase_url.rstrip("/")
        self.timeout = settings.supabase_timeout_seconds
        self.default_headers = {
            "apikey": settings.supabase_anon_key,
            "Content-Type": "application/json",
        }

    async def sign_up(self, email: str, password: str, role: str) -> dict:
        payload = {
            "email": email,
            "password": password,
            "data": {"role": role},
        }
        return await self._request("POST", "/auth/v1/signup", json=payload)

    async def sign_in_with_password(self, email: str, password: str) -> dict:
        payload = {
            "email": email,
            "password": password,
        }
        return await self._request("POST", "/auth/v1/token?grant_type=password", json=payload)

    async def get_user(self, access_token: str) -> dict:
        headers = {
            **self.default_headers,
            "Authorization": f"Bearer {access_token}",
        }
        return await self._request("GET", "/auth/v1/user", headers=headers)

    @classmethod
    def _get_shared_client(cls) -> httpx.AsyncClient:
        if cls._shared_client is None:
            cls._shared_client = httpx.AsyncClient(base_url=settings.supabase_url.rstrip("/"), timeout=settings.supabase_timeout_seconds)
        return cls._shared_client

    @classmethod
    async def close_shared_client(cls) -> None:
        if cls._shared_client is not None:
            await cls._shared_client.aclose()
            cls._shared_client = None

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        headers = kwargs.pop("headers", self.default_headers)
        try:
            client = self._get_shared_client()
            response = await client.request(method, path, headers=headers, **kwargs)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to reach Supabase Auth",
            ) from exc

        if response.is_success:
            return response.json()

        detail = "Supabase authentication failed"
        try:
            payload = response.json()
            detail = (
                payload.get("msg")
                or payload.get("error_description")
                or payload.get("error")
                or payload.get("message")
                or detail
            )
        except ValueError:
            pass

        raise HTTPException(status_code=response.status_code, detail=detail)
