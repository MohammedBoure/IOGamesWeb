# Deployment env

1. Copy `.env.example` to `.env` for local development.
2. Do not upload `.env` to GitHub. Put real production values in your hosting provider.
3. Frontend variables that are used in browser code must start with `VITE_`.
4. After changing `VITE_WS_URL`, run `npm run build` again because Vite embeds it during the build.

## Local frontend

```powershell
npm install
npm run dev
```

## Local backend

```powershell
cd backend
pip install -r requirements.txt
python run.py
```

## Production example

Frontend:

```env
VITE_WS_URL=wss://your-backend-domain.com/ws
```

Backend:

```env
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_RELOAD=false
BACKEND_CORS_ORIGINS=https://your-frontend-domain.com
```

If your host gives you a `PORT` variable, `backend/run.py` can use it automatically.
