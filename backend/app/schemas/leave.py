"""
Leave request/response schemas for Pydantic validation.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LeaveCreate(BaseModel):
    leave_type: str = Field(..., description="Type of leave: sick, casual, paid, unpaid")
    start_date: datetime
    end_date: datetime
    reason: str = Field(..., min_length=1, max_length=500)


class LeaveUpdateStatus(BaseModel):
    status: str = Field(..., description="New status: approved or rejected")
    rejection_reason: Optional[str] = Field(None, max_length=500)


class LeaveResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    company_id: Optional[str] = None
    leave_type: str
    start_date: str
    end_date: str
    duration_days: int
    reason: str
    status: str
    reviewed_by: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

    @classmethod
    def from_leave(cls, leave, user_name: Optional[str] = None, reviewer_name: Optional[str] = None) -> "LeaveResponse":
        duration = (leave.end_date - leave.start_date).days + 1
        return cls(
            id=str(leave.id),
            user_id=str(leave.user_id),
            user_name=user_name,
            company_id=str(leave.company_id) if leave.company_id else None,
            leave_type=leave.leave_type.value,
            start_date=leave.start_date.isoformat() + "Z",
            end_date=leave.end_date.isoformat() + "Z",
            duration_days=duration,
            reason=leave.reason,
            status=leave.status.value,
            reviewed_by=str(leave.reviewed_by) if leave.reviewed_by else None,
            reviewer_name=reviewer_name,
            reviewed_at=leave.reviewed_at.isoformat() + "Z" if leave.reviewed_at else None,
            rejection_reason=leave.rejection_reason,
            created_at=leave.created_at.isoformat() + "Z",
            updated_at=leave.updated_at.isoformat() + "Z" if leave.updated_at else None,
        )


class LeaveBalanceItem(BaseModel):
    leave_type: str
    allowed: Optional[int] = None  # None means unlimited
    used: int
    remaining: Optional[int] = None  # None means unlimited


class LeaveBalanceResponse(BaseModel):
    year: int
    balances: list[LeaveBalanceItem]
