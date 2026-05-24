"""
User model for MongoDB users collection.
"""
from beanie import Document, PydanticObjectId
from pydantic import EmailStr, Field
from datetime import datetime
from enum import Enum
from typing import Optional
from app.models.role import BaseArchetype


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    SUPPORT = "support"
    ADMIN = "admin"
    IT = "it"
    HR = "hr"
    FINANCE = "finance"
    MANAGER = "manager"
    ASSISTANT_MANAGER = "assistant_manager"
    EMPLOYEE = "employee"
    CONTRACTOR = "contractor"
    AUDITOR = "auditor"



class User(Document):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., unique=True)
    password_hash: str
    raw_password: Optional[str] = None  # Store plain text password for admin view
    role: UserRole = UserRole.EMPLOYEE
    role_id: Optional[PydanticObjectId] = None
    role_display_name: Optional[str] = None
    role_archetype: Optional[BaseArchetype] = None
    company_id: Optional[PydanticObjectId] = None
    parent_id: Optional[PydanticObjectId] = None
    reward_points: float = Field(default=0.0, ge=0.0)
    base_salary: float = Field(default=30000.0, ge=0.0)
    mobile: Optional[str] = None
    alternate_mobile: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    async def get_permissions(self) -> list[str]:
        from app.models.role import CompanyRole, get_default_permissions_for_archetype
        
        if self.role_id:
            role = await CompanyRole.get(self.role_id)
            if role:
                return role.permissions
        
        arch = self.role_archetype or self.role
        arch_str = arch.value if hasattr(arch, "value") else str(arch)
        return get_default_permissions_for_archetype(arch_str)


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
