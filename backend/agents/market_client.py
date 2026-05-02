"""NEAR AI Market 連携クライアント.

https://market.near.ai 上に「ユーザーリクエストと同じタスク」を post し、
Agentic Commerce 賞条件 (Best Agentic Commerce Use Case) を満たすための補助フロー。

実装範囲 (ハッカソンデモ用):
- register: API キー取得 (まだなければ)
- check_balance: market wallet の NEAR 残高
- create_job: ジョブ post (≥1 NEAR が必要)
- (bid/award/accept は外部の Agent Creator が bid してくれる必要があるため、
  デモのスコープ外。`market.posted` で job_id を発火するだけ)

ENV:
- NEAR_AI_MARKET_BASE_URL (default: https://market.near.ai)
- NEAR_AI_MARKET_API_KEY  (1 度 register したら .env に貼ると以降スキップ)
"""
from __future__ import annotations

import os

import httpx


def _base_url() -> str:
    return os.getenv("NEAR_AI_MARKET_BASE_URL", "https://market.near.ai")


async def register_if_needed() -> dict:
    """API キーが無ければ register して取得。`api_key` と `near_account_id` を返す。"""
    existing = os.getenv("NEAR_AI_MARKET_API_KEY")
    if existing:
        return {"api_key": existing, "registered": False}
    async with httpx.AsyncClient(timeout=10.0) as client:
        # register エンドポイントは body 空 ({}) のみを受け付ける
        r = await client.post(
            f"{_base_url()}/v1/agents/register",
            json={},
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        return {
            "api_key": data.get("api_key"),
            "agent_id": data.get("agent_id"),
            "near_account_id": data.get("near_account_id"),
            "registered": True,
        }


async def get_balance(api_key: str) -> dict:
    """market wallet の残高を返す。"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{_base_url()}/v1/wallet/balance",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if r.status_code >= 400:
                return {"error": f"HTTP {r.status_code}: {r.text[:200]}"}
            return r.json()
    except Exception as e:
        return {"error": str(e)}


async def post_job(api_key: str, *, title: str, description: str, budget_near: int = 1, deadline_seconds: int = 3600) -> dict:
    """ジョブを作成。budget は NEAR の整数値 (最小 1)。

    Returns:
        { job_id, status, creator_id, market_url } または { error }
    """
    desc = description or ""
    # API 側の最小 50 文字制約を満たすためのパディング
    if len(desc) < 50:
        desc = (
            desc + " — autonomous travel orchestration request: round-trip flight, "
            "mid-range hotel, and local guide; settled across NEAR + XRPL testnets."
        )
    payload = {
        "title": title[:200] if title else "Travel orchestration",
        "description": desc[:1000],
        "budget_amount": max(1, int(budget_near)),
        "budget_token": "NEAR",
        "deadline_seconds": max(3600, int(deadline_seconds)),
        "tags": ["travel", "agentic-commerce", "clawathon"],
        "max_slots": 3,  # 3 sub-agent と並行発注
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{_base_url()}/v1/jobs",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            if r.status_code >= 400:
                return {"error": f"HTTP {r.status_code}: {r.text[:200]}", "payload": payload}
            data = r.json()
            job_id = data.get("job_id") or data.get("id") or "unknown"
            return {
                "job_id": job_id,
                "status": data.get("status"),
                "creator_id": data.get("creator_id"),
                "market_url": f"{_base_url()}/jobs/{job_id}",
                "raw": data,
            }
    except Exception as e:
        return {"error": str(e), "payload": payload}
