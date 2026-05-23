"""
Leave model for MongoDB leaves collection.
Supports sick, casual, paid, and unpaid leave types with approval workflow.
"""
from beanie import Document, PydanticObjectId
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional


class LeaveType(str, Enum):
    SICK = "sick"
    CASUAL = "casual"
    PAID = "paid"
    UNPAID = "unpaid"


class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# Annual leave limits per type (in days)
LEAVE_LIMITS = {
    LeaveType.SICK: 12,
    LeaveType.CASUAL: 12,
    LeaveType.PAID: 15,
    LeaveType.UNPAID: None,  # Unlimited
}


class Leave(Document):
    user_id: PydanticObjectId
    company_id: Optional[PydanticObjectId] = None
    leave_type: LeaveType
    start_date: datetime
    end_date: datetime
    reason: str = Field(..., min_length=1, max_length=500)
    status: LeaveStatus = Field(default=LeaveStatus.PENDING)
    reviewed_by: Optional[PydanticObjectId] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "leaves"
        indexes = ["user_id", "company_id", "status", "start_date", "end_date"]

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "company_id": "507f1f77bcf86cd799439012",
                "leave_type": "sick",
                "start_date": "2026-05-25T00:00:00Z",
                "end_date": "2026-05-26T00:00:00Z",
                "reason": "Feeling unwell",
                "status": "pending",
            }
        }
