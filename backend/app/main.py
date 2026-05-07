from __future__ import annotations

import logging
import os
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from .match_manager import ClientMessageError, MatchManager

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env", override=True)


def list_from_env(name: str, fallback: str = "") -> list[str]:
    value = os.getenv(name, fallback)
    return [item.strip() for item in value.split(",") if item.strip()]


def bool_from_env(name: str, fallback: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return fallback
    return value.strip().lower() in {"1", "true", "yes", "on"}


def configure_logging() -> Path:
    log_dir_value = os.getenv("BACKEND_LOG_DIR")
    log_dir = Path(log_dir_value) if log_dir_value else BACKEND_ROOT / "logs"
    if not log_dir.is_absolute():
        log_dir = BACKEND_ROOT / log_dir
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "backend.log"

    root_logger = logging.getLogger()
    log_level = getattr(logging, os.getenv("BACKEND_LOG_LEVEL", "INFO").upper(), logging.INFO)
    root_logger.setLevel(log_level)

    if not any(getattr(handler, "name", "") == "neon_backend_file" for handler in root_logger.handlers):
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=1_000_000,
            backupCount=3,
            encoding="utf-8",
        )
        file_handler.name = "neon_backend_file"
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
        )
        root_logger.addHandler(file_handler)

    return log_file


LOG_FILE = configure_logging()
logger = logging.getLogger("neon_aim.backend")

CORS_ORIGINS = list_from_env("BACKEND_CORS_ORIGINS", "*")
CORS_ALLOW_CREDENTIALS = bool_from_env("BACKEND_CORS_ALLOW_CREDENTIALS", False)

app = FastAPI(
    title=os.getenv("BACKEND_APP_TITLE", "Neon Aim Arena Backend"),
    version=os.getenv("BACKEND_APP_VERSION", "0.1.0"),
)
logger.info("backend started log_file=%s cors_origins=%s", LOG_FILE, CORS_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS and CORS_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = MatchManager()


@app.middleware("http")
async def log_http_request(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started_at) * 1000
    client_host = request.client.host if request.client else "unknown"
    logger.info(
        "http method=%s path=%s status=%s duration_ms=%.1f client=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        client_host,
    )
    return response


@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "matches": manager.match_count,
        "players": manager.player_count,
    }


@app.get("/matches")
async def matches() -> dict:
    return {"matches": manager.public_matches()}


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    player_name: str = Query(default="Player", min_length=1, max_length=32),
    player_id: str | None = Query(default=None, min_length=1, max_length=64),
) -> None:
    client_host = websocket.client.host if websocket.client else "unknown"
    logger.info(
        "websocket opening player_name=%s requested_player_id=%s client=%s",
        player_name,
        player_id or "-",
        client_host,
    )
    client = await manager.connect(websocket, player_name=player_name, player_id=player_id)

    try:
        while True:
            payload = await websocket.receive_json()
            try:
                await manager.handle_message(client.id, payload)
            except ClientMessageError as exc:
                logger.warning(
                    "websocket client_error player_id=%s code=%s message=%s",
                    client.id,
                    exc.code,
                    exc.message,
                )
                await manager.send_error(client.id, exc.code, exc.message)
    except WebSocketDisconnect:
        logger.info("websocket closed player_id=%s client=%s", client.id, client_host)
        await manager.disconnect(client.id)
    except Exception:
        logger.exception("websocket crashed player_id=%s client=%s", client.id, client_host)
        await manager.disconnect(client.id)
        raise
