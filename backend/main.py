"""FastAPI エントリ。

- `/` フロントエンド (frontend/index.html)
- `/static/*` 静的ファイル
- `POST /api/run` フロー起動 (即 200 を返し、進捗は WebSocket 経由)
- `GET /ws` フロー進捗の WebSocket
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .orchestrator import run_flow
from .ws_manager import WSManager

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"

app = FastAPI(title="Agentic Travel Concierge")

ws_manager = WSManager()


class RunRequest(BaseModel):
    request: str
    budget_usd: float = 500.0
    start_date: str | None = None  # 雑な日付文字列でもOK ("2026-05-10" or "5月10日")
    end_date: str | None = None


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")


app.mount("/static", StaticFiles(directory=str(FRONTEND)), name="static")


@app.post("/api/run")
async def run(payload: RunRequest) -> dict:
    # 日程が来ていれば user_request の末尾に併記する (エージェントが推論で使う)
    req = payload.request.strip()
    if payload.start_date or payload.end_date:
        s = payload.start_date or "?"
        e = payload.end_date or "?"
        req += f"\n[Schedule: {s} 〜 {e}]"
    asyncio.create_task(run_flow(req, payload.budget_usd, ws_manager))
    return {
        "started": True,
        "request": req,
        "budget_usd": payload.budget_usd,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
    }


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "near_ai_configured": bool(os.getenv("NEAR_AI_API_KEY")),
        "near_orchestrator_configured": bool(os.getenv("NEAR_ORCHESTRATOR_ACCOUNT")),
        "xrpl_configured": bool(os.getenv("XRPL_ORCHESTRATOR_SEED")),
    }


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws_manager.connect(ws)
    try:
        while True:
            # クライアントからの送信は無視 (片方向ブロードキャスト)
            await ws.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(ws)
    except Exception:
        await ws_manager.disconnect(ws)
