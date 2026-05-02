"""XRPL testnet faucet で 2 アカウント (orchestrator + local guide) を発行し、.env への設定例を出力する。"""
from __future__ import annotations

import asyncio

from xrpl.asyncio.clients import AsyncWebsocketClient
from xrpl.asyncio.wallet import generate_faucet_wallet


async def main() -> None:
    network = "wss://s.altnet.rippletest.net:51233"
    async with AsyncWebsocketClient(network) as client:
        print("# XRPL testnet faucet (これには10秒程度かかる)")
        orch = await generate_faucet_wallet(client)
        guide = await generate_faucet_wallet(client)

    print()
    print("# === .env に追記 ===")
    print(f"XRPL_NETWORK={network}")
    print(f"XRPL_ORCHESTRATOR_SEED={orch.seed}")
    print(f"XRPL_LOCAL_GUIDE_ADDRESS={guide.classic_address}")
    print()
    print("# orchestrator address:", orch.classic_address)
    print("# guide seed (記録用):", guide.seed)
    print(
        "# explorer:",
        f"https://testnet.xrpl.org/accounts/{orch.classic_address}",
    )


if __name__ == "__main__":
    asyncio.run(main())
