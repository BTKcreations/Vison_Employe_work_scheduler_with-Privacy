"""
User/Employee request/response schemas.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class CreateEmployeeRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class UpdateEmployeeRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class EmployeeResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    reward_points: int
    is_active: bool
    created_at: str
    raw_password: Optional[str] = None

    @classmethod
    def from_user(cls, user) -> "EmployeeResponse":
        return cls(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role.value,
            reward_points=user.reward_points,
            is_active=user.is_active,
            created_at=user.created_at.isoformat() + 'Z',
            raw_password=user.raw_password,
        )
