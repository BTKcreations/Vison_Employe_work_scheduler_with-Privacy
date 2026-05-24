"""
CompanyRole validation schemas for Pydantic.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from app.models.role import BaseArchetype, CompanyRole


class RoleCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    base_archetype: BaseArchetype
    template_role_id: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    denied_permissions: List[str] = Field(default_factory=list)
    parent_role_ids: List[str] = Field(default_factory=list)
    is_template: bool = False


class RoleUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    permissions: Optional[List[str]] = None
    denied_permissions: Optional[List[str]] = None
    parent_role_ids: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: str
    company_id: Optional[str] = None
    display_name: str
    base_archetype: str
    permissions: List[str]
    denied_permissions: List[str]
    parent_role_ids: List[str]
    effective_permissions: List[str]
    is_template: bool
    is_custom: bool

    @classmethod
    def from_role(cls, role: CompanyRole) -> "RoleResponse":
        return cls(
            id=str(role.id),
            company_id=str(role.company_id) if role.company_id else None,
            display_name=role.display_name,
            base_archetype=role.base_archetype.value,
            permissions=role.permissions,
            denied_permissions=role.denied_permissions or [],
            parent_role_ids=[str(x) for x in (role.parent_role_ids or [])],
            effective_permissions=[],
            is_template=getattr(role, "is_template", False),
            is_custom=role.is_custom,
        )
