from .base import SubAgent


class FlightAgent(SubAgent):
    name = "FlightAgent"
    role_prompt = (
        "Your specialty is finding round-trip economy flights from Tokyo (NRT/HND). "
        "Quote a realistic round-trip fare in USD between $180 and $350 for the destination."
    )
    chain = "near"
    receiver_env_key = "NEAR_FLIGHT_AGENT_ACCOUNT"
