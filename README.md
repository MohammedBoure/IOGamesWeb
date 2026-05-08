# IOGamesWeb

Scalable online web games. The current build includes **Neon Aim Arena**, a 3D browser game built with Vite and Three.js, plus a FastAPI/WebSocket backend for players and matches.

## Current Features

- Browser-based 3D gameplay.
- Fast shooter movement and aiming.
- A racing mode in the same arena runtime.
- WebSocket multiplayer.
- Create a match or join an existing match.
- Simple 6-digit Match IDs.
- Backend wake-up check for Render free instances before room actions.
- Recent Match ID shortcut and cleaner room entry flow.
- Deployment settings through `.env`.

## Requirements

- Node.js
- Python 3.11 or newer
- Git

## Environment Setup

Copy the example file into a local `.env` file:

```powershell
Copy-Item .env.example .env
```

Do not commit `.env` to GitHub. It is meant for local or private deployment values. Commit `.env.example` instead.

Important values:

```env
VITE_WS_URL=ws://127.0.0.1:8000/ws
VITE_BACKEND_ACCESS_TOKEN=change-me-local-dev-token
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
BACKEND_CORS_ORIGINS=*
BACKEND_ACCESS_TOKEN=change-me-local-dev-token
```

Use a secure WebSocket URL in production:

```env
VITE_WS_URL=wss://your-backend-domain.com/ws
VITE_BACKEND_ACCESS_TOKEN=replace-with-the-same-production-token
BACKEND_CORS_ORIGINS=https://your-frontend-domain.com
BACKEND_RELOAD=false
BACKEND_ACCESS_TOKEN=replace-with-the-same-production-token
```

`VITE_BACKEND_ACCESS_TOKEN` and `BACKEND_ACCESS_TOKEN` must match. Vite embeds `VITE_` values in browser JavaScript, so this token is a client access key, not a private server secret.
If `BACKEND_ACCESS_TOKEN` is missing, protected backend routes and WebSocket connections are rejected.

## Frontend

From the project root:

```powershell
npm install
npm run dev
```

To create a production build:

```powershell
npm run build
npm run preview
```

Vite embeds `VITE_` variables at build time, so rebuild after changing `VITE_WS_URL` or `VITE_BACKEND_ACCESS_TOKEN`.

## Frontend Structure

The frontend is organized around an app shell that can host more games:

- `src/main.js`: app entry point only.
- `src/ui/appShell.js`: game library, player name, and room create/join flow.
- `src/shared/playerProfile.js`: stores the player name in `localStorage`.
- `src/games/catalog.js`: list of games shown on the home screen.
- `src/games/<game>/index.js`: isolated entry point for each game.
- `src/games/<game>/assets.js`: optional game asset manifest for models and media.
- `src/games/shared/`: shared runtime or assets used only when needed.
- `public/assets/games/`: game images used in the library.

To add a game later, create a new folder in `src/games/`, export `mountGame(options)`, then register it in `src/games/catalog.js`.

## Backend

From the `backend` folder:

```powershell
cd backend
pip install -r requirements.txt
python run.py
```

Health check:

```text
http://127.0.0.1:8000/health
```

Local WebSocket URL:

```text
ws://127.0.0.1:8000/ws
```

## Controls

- `Z`: forward
- `S`: backward
- `Q`: left
- `D`: right
- `Space`: jump
- `Ctrl + Mouse Wheel Up`: precision bunnyhop
- `Ctrl + Mouse Wheel Down`: power slide on the ground, air tuck while airborne
- `Mouse`: look
- `Left Click`: shoot
- `X`: return to game library
- `Esc`: pause

## Multiplayer

From the home screen:

1. Enter the player name.
2. Choose a game.
3. Wait until the backend status says `Backend connected`.
4. Click `Create Room` to get a 6-digit Match ID.
5. Send the Match ID to another player.
6. The other player enters the same Match ID and clicks `Join Room`.

The frontend calls the backend `/health` endpoint on the home screen. On Render's free plan, that request also wakes the sleeping backend and the UI keeps retrying while it shows a wait message.
Match IDs are cleaned automatically to 6 digits, and the last valid Match ID is saved locally for quick reuse.

The local player snapshot is available in the browser:

```js
window.NeonAimNet.getLocalSnapshot()
```

## More Documentation

- Deployment settings: `DEPLOYMENT.md`
- Backend details: `backend/README.md`
