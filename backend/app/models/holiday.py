"""
Holiday model for MongoDB holidays collection.
"""
from beanie import Document, PydanticObjectId
from pydantic import Field
from datetime import datetime
from typing import Optional


class Holiday(Document):
    name: str = Field(..., min_length=1, max_length=200)
    date: datetime
    company_id: Optional[PydanticObjectId] = None # Global if None, else company specific
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "holidays"
        indexes = ["date", "company_id"]
