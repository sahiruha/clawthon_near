"""オーケストレーション層: IronClaw 宣言 → 並列見積 → 最適化 → 並列決済 → 完了。

各ステップで WSManager を通してフロー進捗イベントを配信する。
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

from .agents.base import Quote, optimize_combination
from .agents.flight import FlightAgent
from .agents.hotel import HotelAgent
from .agents.local_guide import LocalGuideAgent
from .chains import near_pay, xrpl_pay
from .ironclaw_client import IronclawClient
from .ws_manager import WSManager


def _ts() -> float:
    return time.time()


async def _emit(ws: WSManager, event_type: str, data: dict[str, Any]) -> None:
    await ws.broadcast({"type": event_type, "ts": _ts(), **data})


async def run_flow(user_request: str, budget_usd: float, ws: WSManager) -> None:
    """E2E フロー。エラーが出ても可視化のために最後まで通す。"""
    await _emit(ws, "flow.start", {"request": user_request, "budget_usd": budget_usd})

    # 1. IronClaw 宣言
    ironclaw = IronclawClient()
    await _emit(ws, "ironclaw.checking", {})
    available = await ironclaw.health()
    announce = await ironclaw.announce_task(user_request)
    await _emit(
        ws,
        "ironclaw.ready",
        {"available": available, "announce": announce},
    )

    # 2. 3 サブエージェント並列見積
    agents = [FlightAgent(), HotelAgent(), LocalGuideAgent()]
    for a in agents:
        await _emit(ws, "agent.thinking", {"agent": a.name, "chain": a.chain})

    async def _quote(a):
        try:
            q = await a.quote(user_request)
            await _emit(ws, "agent.quoted", {"agent": a.name, "quote": q.to_dict()})
            return q
        except Exception as e:
            await _emit(ws, "agent.error", {"agent": a.name, "error": str(e)})
            # 失敗したエージェントはダミーで穴埋め (フロー継続のため)
            return Quote(
                agent=a.name,
                description=f"{a.name} (offline fallback)",
                amount_usd=80.0,
                chain=a.chain,
                receiver=a.receiver,
                raw={"fallback": True},
            )

    quotes: list[Quote] = await asyncio.gather(*[_quote(a) for a in agents])

    # 3. NEAR AI で組合せ最適化
    await _emit(ws, "optimizer.thinking", {"model": "qwen3-30b-a3b"})
    try:
        decision = await optimize_combination(user_request, quotes, budget_usd)
    except Exception as e:
        await _emit(ws, "optimizer.error", {"error": str(e)})
        decision = {
            "accepted": [q.agent for q in quotes],
            "reasoning": "fallback: accept all",
            "total_usd": sum(q.amount_usd for q in quotes),
        }
    await _emit(ws, "optimizer.decided", {"decision": decision})

    accepted_set = set(decision.get("accepted") or [q.agent for q in quotes])
    accepted_quotes = [q for q in quotes if q.agent in accepted_set]

    # 4. 並列決済 (chain ごとにまとめる)
    async def _pay(q: Quote) -> dict:
        await _emit(
            ws,
            "payment.sending",
            {"agent": q.agent, "chain": q.chain, "amount_usd": q.amount_usd},
        )
        try:
            if q.chain == "near":
                receipt = await near_pay.transfer_usd(q.receiver, q.amount_usd)
            elif q.chain == "xrpl":
                receipt = await xrpl_pay.transfer_usd(q.receiver, q.amount_usd)
            else:
                raise RuntimeError(f"unknown chain {q.chain}")
            await _emit(ws, "payment.confirmed", {"agent": q.agent, "receipt": receipt})
            return receipt
        except Exception as e:
            err = {"chain": q.chain, "error": str(e), "agent": q.agent}
            await _emit(ws, "payment.failed", err)
            return err

    receipts = await asyncio.gather(*[_pay(q) for q in accepted_quotes])

    # 5. 完了サマリ
    total_paid = sum(
        r.get("amount_usd", 0) for r in receipts if "tx_hash" in r
    )
    await _emit(
        ws,
        "flow.done",
        {
            "decision": decision,
            "receipts": receipts,
            "total_paid_usd": total_paid,
        },
    )
