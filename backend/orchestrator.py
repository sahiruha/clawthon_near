"""オーケストレーション層: IronClaw 宣言 → 並列見積 → 最適化 → 並列決済 → 完了。

決済ポリシー (重要):
- **オール・オア・ナッシング**。3 エージェント全員から見積が取れて、
  かつ AI 最適化が全員を accept した場合のみ決済へ進む。
- 1 件でも quote 失敗、または AI が一部しか accept しなければ決済はスキップし、
  `flow.needs_replan` イベントを発火して UI に「再提案が必要」と通知する。
- 部分的に支払って完了できない事故を防ぐため。
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
    """E2E フロー。全件 OK のときだけ決済する。"""
    await _emit(ws, "flow.start", {"request": user_request, "budget_usd": budget_usd})

    # 1. IronClaw 宣言
    ironclaw = IronclawClient()
    await _emit(ws, "ironclaw.checking", {})
    available = await ironclaw.health()
    announce = await ironclaw.announce_task(user_request)
    await _emit(ws, "ironclaw.ready", {"available": available, "announce": announce})

    # 2. 3 サブエージェント並列見積
    agents = [FlightAgent(), HotelAgent(), LocalGuideAgent()]
    for a in agents:
        await _emit(ws, "agent.thinking", {"agent": a.name, "chain": a.chain})

    failed_agents: list[str] = []

    async def _quote(a):
        try:
            q = await a.quote(user_request)
            await _emit(ws, "agent.quoted", {"agent": a.name, "quote": q.to_dict()})
            return q
        except Exception as e:
            failed_agents.append(a.name)
            await _emit(ws, "agent.error", {"agent": a.name, "error": str(e)})
            return None

    quotes_raw: list[Quote | None] = await asyncio.gather(
        *[_quote(a) for a in agents]
    )

    # quote phase の合否判定
    if failed_agents:
        await _emit(
            ws,
            "flow.needs_replan",
            {
                "reason": "quote_failed",
                "failed_agents": failed_agents,
                "message": "1 つ以上のエージェントが見積を返さなかったため、決済を中止しました。再提案が必要です。",
                "message_en": "One or more agents failed to return a quote. Settlement aborted. Please request a new plan.",
            },
        )
        return

    quotes: list[Quote] = [q for q in quotes_raw if q is not None]

    # 3. NEAR AI で組合せ最適化
    await _emit(ws, "optimizer.thinking", {"model": "Qwen3-30B-A3B"})
    decision_error: str | None = None
    try:
        decision = await optimize_combination(user_request, quotes, budget_usd)
    except Exception as e:
        decision_error = str(e)
        decision = {"accepted": [], "reasoning": f"optimizer error: {e}", "total_usd": 0}

    await _emit(ws, "optimizer.decided", {"decision": decision})

    if decision_error:
        await _emit(
            ws,
            "flow.needs_replan",
            {
                "reason": "optimizer_error",
                "message": "最適化エンジンがエラーを返しました。再提案が必要です。",
                "message_en": "The optimization engine returned an error. Please request a new plan.",
                "error": decision_error,
            },
        )
        return

    accepted = set(decision.get("accepted") or [])
    all_agent_names = {q.agent for q in quotes}
    missing = sorted(all_agent_names - accepted)

    if missing:
        # AI が一部だけ採択した場合 → 部分払いはせず再提案
        await _emit(
            ws,
            "flow.needs_replan",
            {
                "reason": "partial_acceptance",
                "missing_agents": missing,
                "message": f"AI が {', '.join(missing)} を採択しなかったため、部分支払いを避けて決済を中止しました。再提案が必要です。",
                "message_en": f"AI did not accept {', '.join(missing)}. Settlement aborted to avoid partial payment. Please request a new plan.",
            },
        )
        return

    # 3.5 Preflight 残高チェック (オール・オア・ナッシングの保証)
    near_total = sum(near_pay.usd_to_yocto(q.amount_usd) for q in quotes if q.chain == "near")
    xrpl_total = sum(xrpl_pay.usd_to_drops(q.amount_usd) for q in quotes if q.chain == "xrpl")
    near_balance = 0
    xrpl_balance = 0
    try:
        if near_total > 0:
            near_balance = await near_pay.get_balance_yocto()
        if xrpl_total > 0:
            xrpl_balance = await xrpl_pay.get_balance_drops()
    except Exception as e:
        await _emit(
            ws,
            "flow.needs_replan",
            {
                "reason": "preflight_error",
                "message": f"残高確認に失敗しました: {e}。再提案が必要です。",
                "message_en": f"Balance precheck failed: {e}. Please request a new plan.",
            },
        )
        return

    # gas/reserve のバッファ
    NEAR_GAS_BUFFER = int(0.1 * 1e24)  # 0.1 NEAR
    XRPL_RESERVE_BUFFER = 10_000_000  # 10 XRP (account reserve)

    if near_total + NEAR_GAS_BUFFER > near_balance:
        await _emit(
            ws,
            "flow.needs_replan",
            {
                "reason": "insufficient_balance_near",
                "needed_yocto": str(near_total + NEAR_GAS_BUFFER),
                "balance_yocto": str(near_balance),
                "message": "NEAR の残高が不足しています。1 件も決済を発火せずに中止しました。再提案が必要です。",
                "message_en": "Insufficient NEAR balance. Aborted without sending any payment. Please request a new plan.",
            },
        )
        return

    if xrpl_total + XRPL_RESERVE_BUFFER > xrpl_balance:
        await _emit(
            ws,
            "flow.needs_replan",
            {
                "reason": "insufficient_balance_xrpl",
                "needed_drops": str(xrpl_total + XRPL_RESERVE_BUFFER),
                "balance_drops": str(xrpl_balance),
                "message": "XRP の残高が不足しています。1 件も決済を発火せずに中止しました。再提案が必要です。",
                "message_en": "Insufficient XRP balance. Aborted without sending any payment. Please request a new plan.",
            },
        )
        return

    await _emit(
        ws,
        "preflight.ok",
        {
            "near_needed": str(near_total),
            "near_balance": str(near_balance),
            "xrpl_needed": str(xrpl_total),
            "xrpl_balance": str(xrpl_balance),
            "message": "残高チェック OK — 決済を一括発火",
            "message_en": "Balance check OK — settling all payments",
        },
    )

    # 4. 全員採択 → 並列決済 (chain 別に実送金)
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

    receipts = await asyncio.gather(*[_pay(q) for q in quotes])

    # 5. 完了サマリ — 1 件でも失敗していたら needs_replan で警告
    failed = [r for r in receipts if "tx_hash" not in r]
    total_paid = sum(r.get("amount_usd", 0) for r in receipts if "tx_hash" in r)

    if failed:
        await _emit(
            ws,
            "flow.needs_replan",
            {
                "reason": "settlement_partial",
                "failed_agents": [r.get("agent") for r in failed],
                "message": "決済のうち一部が on-chain で失敗しました。残高や手数料を確認のうえ再提案が必要です。",
                "message_en": "Some on-chain payments failed. Check balances/fees and request a new plan.",
                "receipts": receipts,
                "total_paid_usd": total_paid,
            },
        )
        return

    await _emit(
        ws,
        "flow.done",
        {
            "decision": decision,
            "receipts": receipts,
            "total_paid_usd": total_paid,
        },
    )
