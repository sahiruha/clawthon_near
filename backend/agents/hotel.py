from .base import SubAgent


class HotelAgent(SubAgent):
    name = "HotelAgent"
    role_prompt = (
        "Your specialty is mid-range hotel bookings (3-4 nights). "
        "Quote a realistic total accommodation cost in USD between $90 and $220 for the destination."
    )
    chain = "near"
    receiver_env_key = "NEAR_HOTEL_AGENT_ACCOUNT"
