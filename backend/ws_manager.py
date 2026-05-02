"""WebSocket でフロー進捗イベントをブラウザに配信する。"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class WSManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.connections.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self.connections.discard(ws)

    async def broadcast(self, event: dict[str, Any]) -> None:
        """全接続にイベントをブロードキャスト。"""
        payload = json.dumps(event, ensure_ascii=False)
        async with self._lock:
            dead: list[WebSocket] = []
            for ws in self.connections:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.connections.discard(ws)
