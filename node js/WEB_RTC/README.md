# MeetClone – Production-Grade Video Conferencing Platform

A Google Meet-style real-time video/audio/chat platform built with **Next.js** (frontend) and **Node.js/Express** (backend), featuring WebRTC for peer-to-peer media, WebSocket for signaling & chat, and SQLite for persistence.

---

## Features

- **Authentication** – Email/password signup & login with JWT tokens
- **Dashboard** – Create rooms, join via code/link, view recent meetings
- **Video/Audio Calls** – Multi-user WebRTC with dynamic grid layout
- **Screen Sharing** – Share your screen with all participants
- **Real-Time Chat** – In-call messaging via WebSocket
- **Avatar Fallback** – Colored initials when camera is off or unavailable
- **Call Controls** – Mute/unmute, camera on/off, screen share, leave call
- **Profile Management** – Update display name and avatar color
- **Responsive UI** – Works on desktop and mobile
- **SQLite Database** – Zero-config persistent storage (via sql.js)

---

## Project Structure

```
node js/
├── backend/                 # Node.js + Express API server
│   ├── src/
│   │   ├── server.js        # Entry point – Express + HTTP + WebSocket
│   │   ├── db.js            # SQLite database (sql.js) initialization
│   │   ├── websocket.js     # WebSocket signaling for WebRTC + chat
│   │   ├── middleware/
│   │   │   └── auth.js      # JWT authentication middleware
│   │   └── routes/
│   │       ├── auth.js      # Signup, login, profile routes
│   │       └── rooms.js     # Room CRUD, join/leave routes
│   ├── data/                # SQLite database file (auto-created)
│   ├── .env                 # Environment variables
│   └── package.json
│
└── frontend/                # Next.js 14 (App Router)
    ├── src/
    │   ├── app/
    │   │   ├── layout.js    # Root layout with AuthProvider
    │   │   ├── page.js      # Root redirect
    │   │   ├── globals.css  # Global styles (Google Meet-inspired)
    │   │   ├── login/page.js
    │   │   ├── signup/page.js
    │   │   ├── dashboard/page.js
    │   │   ├── profile/page.js
    │   │   └── room/[id]/page.js  # Video call room
    │   ├── components/
    │   │   ├── VideoTile.js       # Single participant video/avatar
    │   │   ├── ChatSidebar.js     # In-call chat panel
    │   │   └── CallControls.js    # Bottom control bar
    │   ├── hooks/
    │   │   └── useWebRTC.js       # Core WebRTC + WebSocket hook
    │   └── lib/
    │       ├── api.js             # API fetch helper
    │       └── AuthContext.js     # Auth context provider
    ├── next.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── jsconfig.json
    └── package.json
```

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js** 18+ (tested with v20/v22/v24)
- **npm** 9+

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Backend `.env` (already included with defaults):

```env
PORT=5000
JWT_SECRET=meetclone_super_secret_key_change_in_production
FRONTEND_URL=http://localhost:3000
```

### 3. Start Backend

```bash
cd backend
npm run dev    # Uses nodemon for auto-reload
# OR
npm start      # Production mode
```

Backend runs on **http://localhost:5000**

### 4. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on **http://localhost:3000**

### 5. Use the App

1. Open **http://localhost:3000** in your browser
2. **Sign up** with email and password
3. **Create a room** from the dashboard
4. **Share the room link** with others
5. Others open the link, sign up/login, and join the call
6. Use controls to toggle mic, camera, screen share, and chat

---

## Testing Multi-User Locally

Open multiple browser tabs/windows (or use different browsers) to simulate multiple participants:

1. Tab 1: Sign up as User A → Create room → copy link
2. Tab 2: Sign up as User B → Paste link → join call
3. Both tabs should see each other's video/audio

> **Note:** For testing, you may need to allow camera/mic permissions in each tab.

---

## API Endpoints

| Method | Path                    | Auth | Description              |
|--------|-------------------------|------|--------------------------|
| POST   | /api/auth/signup        | No   | Create account           |
| POST   | /api/auth/login         | No   | Login, get JWT           |
| GET    | /api/auth/me            | Yes  | Get current user         |
| PUT    | /api/auth/profile       | Yes  | Update name/avatar color |
| POST   | /api/rooms              | Yes  | Create new room          |
| GET    | /api/rooms              | Yes  | List user's rooms        |
| GET    | /api/rooms/:id          | Yes  | Get room details         |
| POST   | /api/rooms/:id/join     | Yes  | Record room join         |
| POST   | /api/rooms/:id/leave    | Yes  | Record room leave        |
| GET    | /api/health             | No   | Server health check      |

---

## WebSocket Messages

| Type            | Direction      | Description                        |
|-----------------|----------------|------------------------------------|
| join-room       | Client → Server | Join room with token + roomId     |
| room-joined     | Server → Client | Confirmation + existing peers     |
| user-joined     | Server → Client | New participant notification      |
| user-left       | Server → Client | Participant left notification     |
| offer           | Client ↔ Server | SDP offer relay                   |
| answer          | Client ↔ Server | SDP answer relay                  |
| ice-candidate   | Client ↔ Server | ICE candidate relay               |
| user-toggle     | Client ↔ Server | Audio/video toggle notification   |
| screen-share    | Client ↔ Server | Screen sharing state change       |
| chat-message    | Client ↔ Server | Text message broadcast            |

---

## Production Deployment

### Backend (e.g., Railway, Render, VPS)

```bash
cd backend
npm start
```

Set environment variables:
- `PORT` – Server port
- `JWT_SECRET` – Strong random secret
- `FRONTEND_URL` – Your frontend domain (for CORS)

### Frontend (e.g., Vercel, Netlify)

```bash
cd frontend
npm run build
npm start
```

Set environment variables:
- `NEXT_PUBLIC_API_URL` – Your backend URL (e.g., https://api.yourdomain.com)
- `NEXT_PUBLIC_WS_URL` – Your WebSocket URL (e.g., wss://api.yourdomain.com/ws)

### TURN Server (Required for Production)

For calls to work across NATs/firewalls, you need a TURN server:

1. **Free option:** [Open Relay TURN](https://www.metered.ca/tools/openrelay/)
2. **Self-hosted:** [coturn](https://github.com/coturn/coturn)

Add to backend `.env`:
```env
TURN_URL=turn:your-turn-server.com:3478
TURN_USERNAME=user
TURN_CREDENTIAL=password
```

---

## Architecture

```
┌─────────────┐     HTTPS/REST      ┌──────────────┐
│   Next.js   │ ──────────────────→  │  Express API │
│  Frontend   │                      │   (Node.js)  │
│             │     WebSocket/WSS    │              │
│  WebRTC     │ ──────────────────→  │  WS Signaling│
│  (Browser)  │                      │              │
└──────┬──────┘                      │  SQLite DB   │
       │                             └──────────────┘
       │  P2P Media (WebRTC)
       ↕
┌──────┴──────┐
│  Other      │
│  Browsers   │
└─────────────┘
```

- **Signaling** goes through the WebSocket server
- **Media streams** (video/audio) flow directly P2P via WebRTC
- STUN/TURN servers assist with NAT traversal

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Black screen | Check camera permissions; ensure video track is enabled |
| No audio | Check microphone permissions; click "unmute" |
| Can't connect to peer | Check STUN/TURN config; try different network |
| Permission denied | Camera/mic is blocked – click lock icon in browser address bar |
| WebSocket error | Ensure backend is running on port 5000 |

---

## License

MIT
