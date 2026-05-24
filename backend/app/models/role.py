"""
CompanyRole model for MongoDB roles collection.
"""
from enum import Enum
from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import List, Optional


class BaseArchetype(str, Enum):
    # SaaS Provider Level
    SUPER_ADMIN = "super_admin"
    SUPPORT = "support"
    
    # Tenant Level
    ADMIN = "admin"
    IT = "it"
    HR = "hr"
    FINANCE = "finance"
    MANAGER = "manager"
    ASSISTANT_MANAGER = "assistant_manager"
    EMPLOYEE = "employee"
    CONTRACTOR = "contractor"
    AUDITOR = "auditor"


class CompanyRole(Document):
    company_id: Optional[PydanticObjectId] = None  # None indicates system template
    display_name: str = Field(..., min_length=1, max_length=100)
    base_archetype: BaseArchetype
    permissions: List[str] = Field(default_factory=list)
    denied_permissions: List[str] = Field(default_factory=list)
    parent_role_ids: List[PydanticObjectId] = Field(default_factory=list)
    is_template: bool = Field(default=False)
    is_custom: bool = Field(default=True)

    class Settings:
        name = "company_roles"
        indexes = ["company_id"]

    class Config:
        json_schema_extra = {
            "example": {
                "display_name": "Project Manager",
                "base_archetype": "manager",
                "permissions": ["tasks:assign", "tasks:create", "leaves:approve_team"],
                "is_custom": True,
            }
        }


DEFAULT_PERMISSIONS = {
    BaseArchetype.SUPER_ADMIN: [
        "tasks:create",
        "tasks:assign",
        "tasks:qa",
        "attendance:read_team",
        "attendance:edit_team",
        "leaves:approve_team",
        "leaves:manage_policies",
        "payroll:read_salaries",
        "payroll:run",
        "roles:manage",
        "billing:manage",
        "tenants:manage",
    ],
    BaseArchetype.SUPPORT: [
        "billing:read",
        "billing:write",
        "reports:read_all",
    ],
    BaseArchetype.ADMIN: [
        "tasks:create",
        "tasks:assign",
        "tasks:qa",
        "attendance:read_team",
        "attendance:edit_team",
        "leaves:approve_team",
        "leaves:manage_policies",
        "payroll:read_salaries",
        "payroll:run",
        "roles:manage",
        "reports:read_all",
        "integrations:manage",
        "users:manage",
    ],
    BaseArchetype.IT: [
        "users:manage",
        "integrations:manage",
        "roles:manage",
    ],
    BaseArchetype.HR: [
        "attendance:read_team",
        "leaves:approve_team",
        "leaves:manage_policies",
        "payroll:read_salaries",
        "payroll:run",
        "reports:read_all",
        "users:manage",
    ],
    BaseArchetype.FINANCE: [
        "payroll:read_salaries",
        "payroll:run",
        "reports:read_all",
    ],
    BaseArchetype.MANAGER: [
        "tasks:create",
        "tasks:assign",
        "tasks:qa",
        "attendance:read_team",
        "leaves:approve_team",
        "payroll:read_salaries",
    ],
    BaseArchetype.ASSISTANT_MANAGER: [
        "tasks:assign",
        "tasks:qa",
        "attendance:read_team",
        "leaves:approve_team",
        "payroll:read_salaries",
    ],
    BaseArchetype.EMPLOYEE: [
        "tasks:read_assigned",
        "tasks:update_status",
        "attendance:clock_in_out",
        "leaves:apply",
    ],
    BaseArchetype.CONTRACTOR: [
        "tasks:read_assigned",
        "tasks:update_status",
        "attendance:clock_in_out",
    ],
    BaseArchetype.AUDITOR: [
        "reports:read_all",
        "attendance:read_team",
        "payroll:read_salaries",
    ],
}


def get_default_permissions_for_archetype(archetype: BaseArchetype | str) -> List[str]:
    try:
        arch = BaseArchetype(archetype) if isinstance(archetype, str) else archetype
        return DEFAULT_PERMISSIONS.get(arch, [])
    except Exception:
        return []


async def seed_default_roles():
    """Seed system default role templates in the database if they don't exist."""
    for archetype, permissions in DEFAULT_PERMISSIONS.items():
        existing = await CompanyRole.find_one(
            CompanyRole.company_id == None,
            CompanyRole.base_archetype == archetype
        )
        if not existing:
            display_name = archetype.value.replace("_", " ").title()
            role = CompanyRole(
                company_id=None,
                display_name=display_name,
                base_archetype=archetype,
                permissions=permissions,
                is_custom=False
            )
            await role.insert()


async def resolve_effective_permissions_for_role(role: CompanyRole) -> List[str]:
    """Resolve effective permissions via parent inheritance with deny overrides."""
    visited = set()
    allow: set[str] = set()
    deny: set[str] = set()

    async def walk(r: CompanyRole):
        if not r or not r.id or r.id in visited:
            return
        visited.add(r.id)
        allow.update(r.permissions or [])
        deny.update(r.denied_permissions or [])
        for pid in (r.parent_role_ids or []):
            parent = await CompanyRole.get(pid)
            await walk(parent)

    await walk(role)
    return sorted(list(allow - deny))
