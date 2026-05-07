from __future__ import annotations

import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env", override=True)


def bool_from_env(name: str, fallback: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return fallback
    return value.strip().lower() in {"1", "true", "yes", "on"}


def int_from_env(*names: str, fallback: int) -> int:
    for name in names:
        value = os.getenv(name)
        if value:
            try:
                return int(value)
            except ValueError:
                pass
    return fallback


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=os.getenv("BACKEND_HOST", "127.0.0.1"),
        port=int_from_env("BACKEND_PORT", "PORT", fallback=8000),
        reload=bool_from_env("BACKEND_RELOAD", True),
        log_level=os.getenv("BACKEND_LOG_LEVEL", "info").lower(),
    )
