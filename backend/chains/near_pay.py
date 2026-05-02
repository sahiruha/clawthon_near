"""NEAR testnet 送金。py-near を使う。

USD価格 -> NEAR量のレートは固定。デモ用に 1 USD = 0.2 NEAR と仮定 (実 testnet 価格無関係)。
"""
from __future__ import annotations

import os

from py_near.account import Account

USD_TO_NEAR = 0.01  # デモ用固定レート (testnet faucet 残高 10 NEAR で複数回流せるよう小さく)


async def transfer_usd(receiver_account_id: str, amount_usd: float) -> dict:
    """orchestrator -> receiver に NEAR で送金し、TX hash を返す。"""
    sender = os.getenv("NEAR_ORCHESTRATOR_ACCOUNT")
    private_key = os.getenv("NEAR_ORCHESTRATOR_PRIVATE_KEY")
    rpc_url = os.getenv("NEAR_NODE_URL", "https://rpc.testnet.near.org")
    if not sender or not private_key:
        raise RuntimeError("NEAR_ORCHESTRATOR_ACCOUNT/PRIVATE_KEY not set")
    if not receiver_account_id:
        raise RuntimeError("receiver account id is empty")

    near_amount = amount_usd * USD_TO_NEAR
    yocto = int(near_amount * 1e24)

    account = Account(sender, private_key, rpc_addr=rpc_url)
    await account.startup()
    tx = await account.send_money(receiver_account_id, yocto)
    # py-near v1.2 の戻り値は TransactionResult。transaction.hash で取れる
    tx_hash = getattr(getattr(tx, "transaction", None), "hash", None) or str(tx)
    return {
        "chain": "near",
        "tx_hash": tx_hash,
        "explorer_url": f"https://testnet.nearblocks.io/txns/{tx_hash}",
        "amount_usd": amount_usd,
        "amount_native": near_amount,
        "receiver": receiver_account_id,
    }
