"""
Attendance model for MongoDB attendance collection.
"""
from beanie import Document, PydanticObjectId
from pydantic import Field
from datetime import datetime
from typing import Optional, Dict


class Attendance(Document):
    user_id: PydanticObjectId
    company_id: PydanticObjectId
    check_in: datetime = Field(default_factory=datetime.utcnow)
    check_out: Optional[datetime] = None
    location_in: Optional[Dict[str, float]] = None  # {"lat": 0.0, "lng": 0.0}
    location_out: Optional[Dict[str, float]] = None # {"lat": 0.0, "lng": 0.0}
    address_in: Optional[str] = None
    address_out: Optional[str] = None
    status: str = Field(default="present") # present, late, etc.
    remarks: Optional[str] = None

    class Settings:
        name = "attendance"
        indexes = ["user_id", "company_id", "check_in"]

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "company_id": "507f1f77bcf86cd799439012",
                "check_in": "2024-05-08T09:00:00Z",
                "location_in": {"lat": 12.9716, "lng": 77.5946},
                "status": "present"
            }
        }
