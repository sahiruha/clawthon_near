from .base import SubAgent


class LocalGuideAgent(SubAgent):
    """ローカルガイドは現地法人扱い。決済はXRPL経由（クロスボーダー）。"""

    name = "LocalGuideAgent"
    role_prompt = (
        "Your specialty is providing a local guide for a half-day city tour. "
        "Quote a realistic price in USD between $40 and $120 for the destination."
    )
    chain = "xrpl"
    receiver_env_key = "XRPL_LOCAL_GUIDE_ADDRESS"
