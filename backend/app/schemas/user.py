"""
User/Employee request/response schemas.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class CreateEmployeeRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    role: Optional[str] = "employee"
    base_salary: Optional[float] = 30000.0
    mobile: Optional[str] = None
    alternate_mobile: Optional[str] = None
    parent_id: Optional[str] = None
    company_id: Optional[str] = None


class UpdateEmployeeRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    mobile: Optional[str] = None
    alternate_mobile: Optional[str] = None
    reward_points: Optional[float] = None
    base_salary: Optional[float] = None
    role: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    parent_id: Optional[str] = None
    company_id: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    reward_points: float
    base_salary: float
    is_active: bool
    created_at: str
    raw_password: Optional[str] = None
    mobile: Optional[str] = None
    alternate_mobile: Optional[str] = None
    parent_id: Optional[str] = None
    parent_name: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None

    @classmethod
    def from_user(cls, user, parent_name: Optional[str] = None, company_name: Optional[str] = None) -> "EmployeeResponse":
        return cls(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role.value,
            reward_points=user.reward_points,
            base_salary=getattr(user, "base_salary", 30000.0),
            is_active=user.is_active,
            created_at=user.created_at.isoformat() + 'Z',
            raw_password=user.raw_password,
            mobile=user.mobile,
            alternate_mobile=user.alternate_mobile,
            parent_id=str(user.parent_id) if getattr(user, "parent_id", None) else None,
            parent_name=parent_name,
            company_id=str(user.company_id) if getattr(user, "company_id", None) else None,
            company_name=company_name,
        )
