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
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "companies"
        indexes = ["name"]
