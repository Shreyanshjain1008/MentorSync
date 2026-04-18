# MentorSync

> A real-time 1-on-1 mentor–student collaboration platform featuring live code editing, video conferencing, and instant messaging — all in a single shared session.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Real-Time Communication](#real-time-communication)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Deployment](#deployment)

---

## Overview

MentorSync connects mentors and students through dedicated session links where they can collaborate in real time. The platform combines a **shared Monaco code editor** with live cursor sync, **WebRTC video conferencing**, and a **WebSocket-powered chat** — creating a complete remote mentorship environment without needing external tools.

---

## Features

### Core
- **Session Rooms** — Unique shareable links per session; join as mentor or student
- **Live Code Editor** — Monaco Editor with real-time code sync and cursor position broadcasting for both users
- **WebRTC Video Conferencing** — Peer-to-peer video with microphone, camera, and screen sharing controls
- **Instant Messaging** — Real-time chat within the session room, persisted to the database
- **Role-Based Access** — Mentors can create and end sessions; students can join via link

### Technical
- WebSocket-based real-time sync for code and chat (with HTTP polling fallback)
- Duplicate event deduplication and stale event rejection for code sync
- Client ID tagging to prevent echo of your own code events
- Automatic reconnection handling with pending sync flush on reconnect
- Code snapshot persistence with conflict resolution between WebSocket and HTTP paths
- JWT / Supabase Auth protected routes
- Optional Redis Pub/Sub for horizontally scaled WebSocket broadcasting

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Code Editor | Monaco Editor |
| Backend | FastAPI (Python), Uvicorn |
| Real-Time | WebSockets (native), WebRTC |
| Database | PostgreSQL |
| Auth | JWT or Supabase Auth |
| Cache / Scale | Redis Pub/Sub (optional) |
| Frontend Deploy | Vercel |
| Backend Deploy | Render / Railway |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser Client                    │
│                                                     │
│   ┌──────────┐  ┌──────────────┐  ┌─────────────┐  │
│   │  Video   │  │ Code Editor  │  │    Chat     │  │
│   │ (WebRTC) │  │   (Monaco)   │  │  (WS/HTTP)  │  │
│   └────┬─────┘  └──────┬───────┘  └──────┬──────┘  │
│        │               │                 │          │
└────────┼───────────────┼─────────────────┼──────────┘
         │               │                 │
    Signaling WS    Code Sync WS       Chat WS
         │               │                 │
┌────────┼───────────────┼─────────────────┼──────────┐
│        │        FastAPI Backend           │          │
│   /ws/signaling  /ws/code/{id}     /ws/chat/{id}    │
│        │               │                 │          │
│        └───────────────┴─────────────────┘          │
│                        │                            │
│              ┌─────────┴──────────┐                 │
│              │     PostgreSQL     │                 │
│              │  users, sessions,  │                 │
│              │  messages, code    │                 │
│              │     snapshots      │                 │
│              └────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

Three WebSocket channels per session:
- `/ws/chat/{sessionId}` — chat messages
- `/ws/code/{sessionId}` — code content + cursor position
- `/ws/signaling/{sessionId}` — WebRTC signaling + presence + session-ended events

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- Redis (optional, for scaled deployments)

---

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/your-username/mentorsync.git
cd mentorsync/backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
alembic upgrade head

# Start the development server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs at `http://localhost:8000/docs`.

---

### Frontend Setup

```bash
cd mentorsync/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

### Environment Variables

**Backend — `backend/.env`**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mentorsync
SECRET_KEY=your-jwt-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Supabase Auth (if using Supabase instead of JWT)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

**Frontend — `frontend/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Supabase (if using Supabase Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Project Structure

```
mentorsync/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── alembic/                 # Database migrations
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/          # REST endpoints (sessions, messages, snapshots)
│   │   │   └── deps.py          # Auth dependency injection
│   │   ├── services/            # Business logic layer
│   │   ├── websockets/
│   │   │   ├── chat.py          # Chat WS handler
│   │   │   ├── code.py          # Code sync WS handler
│   │   │   └── signaling.py     # WebRTC signaling + presence
│   │   ├── models/              # SQLAlchemy ORM models
│   │   └── schemas/             # Pydantic request/response schemas
│   └── core/
│       ├── config.py            # Environment config
│       ├── security.py          # JWT utilities
│       └── database.py          # DB session management
│
└── frontend/
    ├── app/
    │   ├── dashboard/           # Session list page
    │   └── session/[id]/        # Session room page
    ├── components/
    │   ├── layout/
    │   │   ├── AppHeader.tsx
    │   │   └── LoadingScreen.tsx
    │   └── session/
    │       ├── VideoPanel.tsx    # WebRTC video UI
    │       ├── CodeEditorPanel.tsx  # Monaco editor wrapper
    │       └── ChatPanel.tsx    # Chat UI
    ├── hooks/
    │   ├── use-websocket.ts     # Generic WebSocket hook with reconnect
    │   └── use-auth-guard.ts    # Route protection hook
    ├── store/
    │   ├── auth-store.ts        # Zustand auth state
    │   └── session-store.ts     # Zustand session + message state
    ├── lib/
    │   ├── api.ts               # HTTP API client
    │   └── utils.ts
    └── types/
        ├── auth.ts
        └── session.ts
```

---

## Real-Time Communication

### Code Sync

Code changes are debounced and sent over the `/ws/code/{sessionId}` WebSocket. Each event includes:

```json
{
  "code": "// current editor content",
  "cursor_position": 42,
  "client_id": "uuid-of-sender",
  "sender_id": "user-uuid",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

**Deduplication logic:**
- Events from your own `client_id` are silently dropped
- Stale events (older `updated_at` than the last received) are rejected
- Exact-duplicate events (same timestamp + code + cursor + sender) are ignored

**Fallback path:** If the WebSocket is closed when an edit occurs, the change is saved via `POST /sessions/{id}/code-snapshot` and polled every 2.5 seconds by the other participant until the socket reconnects.

### WebRTC Signaling

The `/ws/signaling/{sessionId}` channel handles:

| `signal_type` | Direction | Purpose |
|---|---|---|
| `presence` | Client → Server → Peer | Announce join |
| `offer` | Caller → Callee | WebRTC SDP offer |
| `answer` | Callee → Caller | WebRTC SDP answer |
| `ice-candidate` | Both | ICE candidate exchange |
| `session-ended` | Mentor → All | Redirect all participants to dashboard |

---

## Authentication

MentorSync supports two auth strategies — pick one per deployment:

**JWT (self-hosted)**
- `POST /auth/register` — create account
- `POST /auth/login` — receive access token
- All API and WebSocket connections pass `Authorization: Bearer <token>`

**Supabase Auth**
- Handles registration, login, and token refresh on the frontend
- Backend validates the JWT using the Supabase public key
- Role (`mentor` / `student`) stored as a custom claim or in the `users` table

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  hashed_password TEXT,           -- null if using Supabase Auth
  role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES users(id),
  student_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Code Snapshots
CREATE TABLE code_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  code TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'javascript',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Deployment

### Frontend (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from the frontend directory
cd frontend
vercel --prod
```

Set all `NEXT_PUBLIC_*` environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Backend (Render)

1. Create a new **Web Service** on Render pointed at your repo's `backend/` directory
2. Set **Build Command:** `pip install -r requirements.txt`
3. Set **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add all backend environment variables under **Environment**
5. Attach a **PostgreSQL** database add-on (Render provides managed Postgres)

### Scaling WebSockets with Redis

For deployments with multiple backend instances, enable Redis Pub/Sub so WebSocket events are broadcast across all instances:

```env
REDIS_URL=redis://your-redis-host:6379
```

When `REDIS_URL` is set, the backend automatically routes all WebSocket messages through Redis channels instead of in-process broadcasting.

---


<p align="center">Built with FastAPI · Next.js · Monaco Editor · WebRTC · PostgreSQL</p>