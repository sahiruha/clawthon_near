"""E2E テスト: WebSocket でフローイベントを全て受信し、HTTP で /api/run を叩く。"""
from __future__ import annotations

import asyncio
import json

import httpx
from websockets.asyncio.client import connect


async def listen(stop_event: asyncio.Event) -> None:
    async with connect("ws://127.0.0.1:8000/ws") as ws:
        try:
            while not stop_event.is_set():
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                event = json.loads(msg)
                t = event.get("type", "?")
                # コンパクト表示
                detail = ""
                if t == "agent.quoted":
                    q = event["quote"]
                    detail = f"{q['agent']} ${q['amount_usd']} ({q['chain']})"
                elif t == "optimizer.decided":
                    d = event["decision"]
                    detail = f"accepted={d.get('accepted')} total=${d.get('total_usd')}"
                elif t == "payment.confirmed":
                    r = event["receipt"]
                    detail = f"{event['agent']} ${r['amount_usd']} → {r['explorer_url']}"
                elif t == "payment.failed":
                    detail = f"{event['agent']} ERR: {event.get('error', '')[:120]}"
                elif t == "ironclaw.ready":
                    detail = f"available={event.get('available')} announce={event.get('announce', {}).get('binary_version', '')}"
                elif t == "flow.done":
                    detail = f"total_paid=${event['total_paid_usd']}, receipts={len(event.get('receipts', []))}"
                    print(f"[{t}] {detail}")
                    stop_event.set()
                    break
                print(f"[{t}] {detail}")
        finally:
            pass


async def main() -> None:
    stop = asyncio.Event()
    listener = asyncio.create_task(listen(stop))
    await asyncio.sleep(0.5)  # WebSocket 接続が確立するのを待つ
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "http://127.0.0.1:8000/api/run",
            json={"request": "next week to Bangkok, budget 500 USD", "budget_usd": 500},
        )
        print(f"POST /api/run -> {r.status_code} {r.text}")

    try:
        await asyncio.wait_for(listener, timeout=120)
    except asyncio.TimeoutError:
        print("TIMEOUT waiting for flow.done")
        stop.set()


if __name__ == "__main__":
    asyncio.run(main())
