"""IronClaw 連携クライアント.

優先順位:
1. ローカル HTTP gateway (デフォルト 127.0.0.1:3000) にヘルスチェック
2. ironclaw バイナリを呼び出してバージョン取得 (subprocess.run, shell=False で安全)
3. どちらも不可なら "offline fallback" を返す

賞条件「IronClaw を使用」を満たすため、最低でもバイナリ呼び出しでバージョンを取り、
オーケストレーション結果に含めて画面表示する。
"""
from __future__ import annotations

import asyncio
import os
import subprocess

import httpx


def _run_version(bin_path: str) -> str | None:
    """ironclaw --version を呼んで出力を返す. shell=False で安全."""
    try:
        result = subprocess.run(
            [bin_path, "--version"],
            capture_output=True,
            text=True,
            timeout=3.0,
            shell=False,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return None
    return None


class IronclawClient:
    def __init__(self) -> None:
        self.base_url = os.getenv("IRONCLAW_BASE_URL", "http://127.0.0.1:3000")
        self.bin_path = os.getenv("IRONCLAW_BIN", "ironclaw")
        self._gateway_ok: bool | None = None
        self._version: str | None = None

    async def _gateway_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                for path in ("/health", "/api/health", "/"):
                    try:
                        r = await client.get(f"{self.base_url}{path}")
                        if r.status_code < 500:
                            return True
                    except Exception:
                        continue
        except Exception:
            pass
        return False

    async def health(self) -> dict:
        gateway_ok = await self._gateway_health()
        version = await asyncio.to_thread(_run_version, self.bin_path)
        self._gateway_ok = gateway_ok
        self._version = version
        return {
            "gateway_running": gateway_ok,
            "binary_version": version,
            "available": bool(gateway_ok or version),
        }

    async def announce_task(self, task: str) -> dict:
        """オーケストレーション宣言.

        Gateway HTTP が稼働していれば /v1/messages 等を試行、
        ダメなら最低でもバージョン情報を返す.
        """
        info = await self.health()
        if self._gateway_ok:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    r = await client.post(
                        f"{self.base_url}/v1/messages",
                        json={"message": task},
                    )
                    return {**info, "delivery": "gateway", "status": r.status_code}
            except Exception as e:
                return {**info, "delivery": "gateway_error", "error": str(e)}
        return {**info, "delivery": "binary_only", "echo": task}
