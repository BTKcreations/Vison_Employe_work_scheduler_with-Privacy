"""
Category model for MongoDB categories collection.
"""
from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class Category(Document):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#6366f1")  # Default indigo color
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "categories"
        indexes = ["name"]

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Development",
                "color": "#6366f1",
                "is_active": True,
            }
        }
