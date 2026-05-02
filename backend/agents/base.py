"""NEAR AI Cloud (OpenAI互換) クライアント基盤。

cloud.near.ai でAPIキー発行 → クーポンコード `NEAR-HACK-TOKYO` で $5 のクレジット。
OpenAI互換SDK経由で Qwen3-30B-A3B を呼ぶ。
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from openai import AsyncOpenAI


def _build_client() -> AsyncOpenAI:
    api_key = os.getenv("NEAR_AI_API_KEY")
    base_url = os.getenv("NEAR_AI_BASE_URL", "https://cloud-api.near.ai/v1")
    if not api_key:
        raise RuntimeError("NEAR_AI_API_KEY is not set in .env")
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


def _model() -> str:
    return os.getenv("NEAR_AI_MODEL", "qwen3-30b-a3b")


@dataclass
class Quote:
    """サブエージェントが返す見積結果。"""

    agent: str
    description: str
    amount_usd: float
    chain: str  # "near" | "xrpl"
    receiver: str
    raw: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "description": self.description,
            "amount_usd": self.amount_usd,
            "chain": self.chain,
            "receiver": self.receiver,
        }


class SubAgent:
    """各サブエージェントの共通基底。

    NEAR AI Cloud にプロンプトを投げ、JSON で見積を返させる。
    """

    name: str = "BaseAgent"
    role_prompt: str = ""
    chain: str = "near"
    receiver_env_key: str = ""

    def __init__(self) -> None:
        self.client = _build_client()
        self.receiver = os.getenv(self.receiver_env_key, "")

    async def quote(self, user_request: str) -> Quote:
        prompt = (
            f"You are {self.name} for an autonomous travel concierge marketplace. "
            f"{self.role_prompt}\n\n"
            f"User request: {user_request}\n\n"
            'Respond ONLY with strict JSON: '
            '{"description": "<one-line summary>", "amount_usd": <number>}'
        )
        completion = await self.client.chat.completions.create(
            model=_model(),
            messages=[
                {"role": "system", "content": "You output strict JSON. No prose."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
        )
        content = (completion.choices[0].message.content or "").strip()
        # 念のため markdown フェンスを剥がす
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:].strip()
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # フォールバック: モデルが乱れたら固定値
            data = {"description": f"{self.name} fallback offer", "amount_usd": 100.0}
        return Quote(
            agent=self.name,
            description=str(data.get("description", "")),
            amount_usd=float(data.get("amount_usd", 0)),
            chain=self.chain,
            receiver=self.receiver,
            raw=data,
        )


async def optimize_combination(
    user_request: str, quotes: list[Quote], budget_usd: float
) -> dict[str, Any]:
    """NEAR AI Cloud で複数見積から最適組合せを判断。"""
    client = _build_client()
    quotes_json = json.dumps([q.to_dict() for q in quotes], ensure_ascii=False)
    prompt = (
        "You are an autonomous orchestrator. Given a user request, candidate quotes, "
        "and a budget, choose which agents to accept to maximize coverage within budget. "
        f"\n\nUser request: {user_request}"
        f"\nBudget USD: {budget_usd}"
        f"\nQuotes: {quotes_json}"
        "\n\nRespond ONLY with strict JSON: "
        '{"accepted": ["<agent_name>", ...], "reasoning": "<short>", "total_usd": <number>}'
    )
    completion = await client.chat.completions.create(
        model=_model(),
        messages=[
            {"role": "system", "content": "You output strict JSON. No prose."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    content = (completion.choices[0].message.content or "").strip()
    if content.startswith("```"):
        content = content.strip("`")
        if content.startswith("json"):
            content = content[4:].strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # フォールバック: 全部受ける
        return {
            "accepted": [q.agent for q in quotes],
            "reasoning": "fallback: accept all",
            "total_usd": sum(q.amount_usd for q in quotes),
        }
