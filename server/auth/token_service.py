import os
import time
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

class TokenService:
    """
    Server-side LiveKit JWT token generator.
    Keeps LIVEKIT_API_KEY and LIVEKIT_API_SECRET strictly server-side.
    """
    def __init__(self):
        self.api_key = os.environ.get("LIVEKIT_API_KEY", "").strip()
        self.api_secret = os.environ.get("LIVEKIT_API_SECRET", "").strip()
        self.livekit_url = os.environ.get("LIVEKIT_URL", "").strip()

    @property
    def is_configured(self) -> bool:
        return bool(
            self.api_key and not self.api_key.startswith("your_") and
            self.api_secret and not self.api_secret.startswith("your_") and
            self.livekit_url and not self.livekit_url.startswith("wss://your-")
        )

    def create_token(self, room_name: str = "echoguard-room", identity: Optional[str] = None) -> Dict[str, Any]:
        if not self.is_configured:
            return {
                "token": None,
                "configured": False,
                "url": self.livekit_url,
                "room": room_name,
                "error": "LiveKit credentials not configured in server environment."
            }

        try:
            from livekit.api import AccessToken, VideoGrants
            
            user_identity = identity or f"user-{int(time.time())}"
            grants = VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
            
            token = (
                AccessToken(self.api_key, self.api_secret)
                .with_identity(user_identity)
                .with_name(user_identity)
                .with_grants(grants)
                .to_jwt()
            )
            
            return {
                "token": token,
                "configured": True,
                "url": self.livekit_url,
                "room": room_name,
                "identity": user_identity,
                "expiresIn": 3600
            }
        except Exception as e:
            return {
                "token": None,
                "configured": False,
                "url": self.livekit_url,
                "room": room_name,
                "error": str(e)
            }
