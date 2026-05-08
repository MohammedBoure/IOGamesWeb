# IOGamesWeb Backend

A small FastAPI backend for WebSocket players and matches. State is currently stored in memory, so matches disappear when the server restarts.

## Setup

From the project root, copy the environment example:

```powershell
Copy-Item .env.example .env
```

You can also create `backend/.env` for backend-only values. Values in `backend/.env` override values from the project root `.env`.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

## Environment Variables

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
BACKEND_RELOAD=true
BACKEND_LOG_LEVEL=info
BACKEND_LOG_DIR=logs
BACKEND_CORS_ORIGINS=*
BACKEND_CORS_ALLOW_CREDENTIALS=false
BACKEND_APP_TITLE=Neon Aim Arena Backend
BACKEND_APP_VERSION=0.1.0
```

In production, set CORS to the frontend origin only:

```env
BACKEND_HOST=0.0.0.0
BACKEND_RELOAD=false
BACKEND_CORS_ORIGINS=https://your-frontend-domain.com
```

If your host provides a `PORT` variable, `backend/run.py` can use it automatically when `BACKEND_PORT` is not set.

## URLs

```text
GET http://127.0.0.1:8000/health
GET http://127.0.0.1:8000/matches
WS  ws://127.0.0.1:8000/ws?player_name=Player
```

## WebSocket Messages

Create a match:

```json
{
  "type": "create_match",
  "settings": {
    "mode": "deathmatch",
    "map": "aim_arena",
    "max_players": 12
  }
}
```

Join a match:

```json
{
  "type": "join_match",
  "match_id": "123456"
}
```

Update player state:

```json
{
  "type": "player_update",
  "state": {
    "position": [0, 0, 0],
    "rotation": [0, 0],
    "velocity": [0, 0, 0],
    "grounded": true,
    "bhopChain": 0
  }
}
```

Send a shot:

```json
{
  "type": "shoot",
  "payload": {
    "origin": [0, 1.7, 0],
    "direction": [0, 0, -1],
    "weapon": "rifle",
    "client_time": 123.45
  }
}
```

Other messages:

```json
{ "type": "list_matches" }
{ "type": "leave_match" }
{ "type": "set_ready", "ready": true }
{ "type": "start_match" }
{ "type": "ping" }
```

## Notes

- This is an early version and state is in memory only.
- A database or Redis can be added later for persistent rooms, authentication, and stronger movement synchronization.
