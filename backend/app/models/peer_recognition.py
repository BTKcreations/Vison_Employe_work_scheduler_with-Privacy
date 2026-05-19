"""
Peer Recognition model for the collaboration system.
"""
from beanie import Document, PydanticObjectId
from pydantic import Field
from datetime import datetime
from typing import Optional

class PeerRecognition(Document):
    sender_id: PydanticObjectId
    sender_name: str
    receiver_id: PydanticObjectId
    receiver_name: str
    company_id: Optional[PydanticObjectId] = None
    points: float = Field(default=1.0)
    reason: str = Field(..., min_length=5, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "peer_recognitions"
        indexes = ["sender_id", "receiver_id", "company_id", "created_at"]
