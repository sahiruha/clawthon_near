"""XRPL testnet 送金。xrpl-py の async client を使う。

USD価格 -> XRP量のレートは固定。デモ用に 1 USD = 2 XRP と仮定。
"""
from __future__ import annotations

import os

from xrpl.asyncio.clients import AsyncWebsocketClient
from xrpl.asyncio.transaction import autofill_and_sign, submit_and_wait
from xrpl.models.transactions import Payment
from xrpl.utils import xrp_to_drops
from xrpl.wallet import Wallet

USD_TO_XRP = 0.1  # デモ用固定レート (testnet faucet 残高100 XRPで複数回流せるよう小さく)


async def transfer_usd(destination: str, amount_usd: float) -> dict:
    """orchestrator -> destination に XRP で送金し、TX hash を返す。"""
    seed = os.getenv("XRPL_ORCHESTRATOR_SEED")
    network = os.getenv("XRPL_NETWORK", "wss://s.altnet.rippletest.net:51233")
    if not seed:
        raise RuntimeError("XRPL_ORCHESTRATOR_SEED not set")
    if not destination:
        raise RuntimeError("XRPL destination is empty")

    wallet = Wallet.from_seed(seed)
    xrp_amount = amount_usd * USD_TO_XRP
    drops = xrp_to_drops(round(xrp_amount, 6))

    async with AsyncWebsocketClient(network) as client:
        payment = Payment(
            account=wallet.classic_address,
            amount=drops,
            destination=destination,
        )
        signed = await autofill_and_sign(payment, client, wallet)
        result = await submit_and_wait(signed, client)

    tx_hash = result.result.get("hash")
    return {
        "chain": "xrpl",
        "tx_hash": tx_hash,
        "explorer_url": f"https://testnet.xrpl.org/transactions/{tx_hash}",
        "amount_usd": amount_usd,
        "amount_native": xrp_amount,
        "receiver": destination,
    }
