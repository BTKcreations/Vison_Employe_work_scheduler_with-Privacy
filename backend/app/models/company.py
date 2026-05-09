"""
Company model for MongoDB companies collection.
"""
from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class Company(Document):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    work_days: list[str] = Field(default=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    work_start_time: str = Field(default="09:00")
    work_end_time: str = Field(default="18:00")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "companies"
        indexes = ["name"]
