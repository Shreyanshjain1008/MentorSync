# MentorSync Frontend

Next.js frontend for MentorSync.

## Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000
```

## Commands

```powershell
npm install
npm run dev
npm run typecheck
npm run build
```

## Notes

- Uses the live FastAPI backend, not mock data.
- WebSockets reconnect automatically.
- `NEXT_PUBLIC_WS_URL` can be `wss://...` in production.
- If `NEXT_PUBLIC_WS_URL` is omitted, the app derives it from `NEXT_PUBLIC_API_URL`.
