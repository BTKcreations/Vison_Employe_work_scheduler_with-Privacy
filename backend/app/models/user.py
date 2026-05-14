"""
User model for MongoDB users collection.
"""
from beanie import Document, PydanticObjectId
from pydantic import EmailStr, Field
from datetime import datetime
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


class User(Document):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., unique=True)
    password_hash: str
    raw_password: Optional[str] = None  # Store plain text password for admin view
    role: UserRole = UserRole.EMPLOYEE
    company_id: Optional[PydanticObjectId] = None
    reward_points: int = Field(default=0, ge=0)
    mobile: Optional[str] = None
    alternate_mobile: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "users"
        indexes = ["email"]

    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "email": "john@example.com",
                "password_hash": "hashed_password",
                "role": "employee",
                "reward_points": 0,
                "is_active": True,
            }
        }
