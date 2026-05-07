"""
Activity Log model for MongoDB activity_logs collection.
"""
from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional
from beanie import PydanticObjectId


class ActivityLog(Document):
    user_id: PydanticObjectId
    action: str = Field(..., max_length=100)
    task_id: Optional[PydanticObjectId] = None
    details: Optional[str] = Field(default=None, max_length=500)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "activity_logs"
        indexes = ["user_id", "timestamp"]
