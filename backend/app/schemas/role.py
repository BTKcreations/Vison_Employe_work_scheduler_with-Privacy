"""
CompanyRole validation schemas for Pydantic.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from app.models.role import BaseArchetype, CompanyRole


class RoleCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    base_archetype: BaseArchetype
    permissions: List[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    permissions: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: str
    company_id: Optional[str] = None
    display_name: str
    base_archetype: str
    permissions: List[str]
    is_custom: bool

    @classmethod
    def from_role(cls, role: CompanyRole) -> "RoleResponse":
        return cls(
            id=str(role.id),
            company_id=str(role.company_id) if role.company_id else None,
            display_name=role.display_name,
            base_archetype=role.base_archetype.value,
            permissions=role.permissions,
            is_custom=role.is_custom,
        )
