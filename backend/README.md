# Real-Time Platform (Phase 1 Scaffold)

This workspace now has separate projects:

- `backend/` (Rust + Axum + SQLite + JWT + WebSocket signaling)
- `frontend/` (Next.js App Router skeleton)

## Backend Features Implemented (Phase 1)

- Auth routes: register, login, guest, me
- Room routes: create, join, get, delete
- Chat routes: list, send
- WebSocket signaling endpoint: `/ws?room_id=...&user_id=...`
- SQLite migrations auto-run on startup
- Modular folder structure aligned with your architecture spec

## Run Backend

```bash
cd backend
cargo run
```

Server:

- `http://127.0.0.1:8080/health`
- `http://127.0.0.1:8080/ready`

## Quick API Test (curl)

Register:

```bash
curl -X POST http://127.0.0.1:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass1234"}'
```

Login:

```bash
curl -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass1234"}'
```

Create room (replace TOKEN):

```bash
curl -X POST http://127.0.0.1:8080/api/rooms/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Daily Standup","is_private":false,"access_key":null}'
```

Send chat message (replace TOKEN + ROOM_ID):

```bash
curl -X POST http://127.0.0.1:8080/api/chat/send \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"room_id":"ROOM_ID","content":"hello team"}'
```

## Frontend (Phase 1 Skeleton)

```bash
cd frontend
npm install
npm run dev
```

Default frontend uses backend URL:

- `http://127.0.0.1:8080`

## Next Phase

- Connect frontend auth/room/chat flows to backend
- Add typed API contract sharing
- Add real WebRTC media hooks + P2P negotiation
- Add SFU-ready signaling event schema and room participant state
- Add tests + CI checks
