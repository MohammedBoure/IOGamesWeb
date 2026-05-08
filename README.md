# IOGamesWeb

Scalable online web games. The current build includes **Neon Aim Arena**, a 3D browser game built with Vite and Three.js, plus a FastAPI/WebSocket backend for players and matches.

## Current Features

- Browser-based 3D gameplay.
- Fast shooter movement and aiming.
- A racing mode in the same arena runtime.
- WebSocket multiplayer.
- Create a match or join an existing match.
- Simple 6-digit Match IDs.
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
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
BACKEND_CORS_ORIGINS=*
```

Use a secure WebSocket URL in production:

```env
VITE_WS_URL=wss://your-backend-domain.com/ws
BACKEND_CORS_ORIGINS=https://your-frontend-domain.com
BACKEND_RELOAD=false
```

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

Vite embeds `VITE_` variables at build time, so rebuild after changing `VITE_WS_URL`.

## Frontend Structure

The frontend is organized around an app shell that can host more games:

- `src/main.js`: app entry point only.
- `src/ui/appShell.js`: game library, player name, and room create/join flow.
- `src/shared/playerProfile.js`: stores the player name in `localStorage`.
- `src/games/catalog.js`: list of games shown on the home screen.
- `src/games/<game>/index.js`: isolated entry point for each game.
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
- `Ctrl + Mouse Wheel Up`: bunnyhop
- `Ctrl + Mouse Wheel Down`: fast slide
- `Mouse`: look
- `Left Click`: shoot
- `X`: return to game library
- `Esc`: pause

## Multiplayer

From the home screen:

1. Enter the player name.
2. Choose a game.
3. Click `Create Room` to get a 6-digit Match ID.
4. Send the Match ID to another player.
5. The other player enters the same Match ID and clicks `Join Room`.

The local player snapshot is available in the browser:

```js
window.NeonAimNet.getLocalSnapshot()
```

## More Documentation

- Deployment settings: `DEPLOYMENT.md`
- Backend details: `backend/README.md`
