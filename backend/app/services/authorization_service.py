"""
Shared authorization and tenant-scoping helpers.
"""
from typing import Iterable, Literal, Optional

from beanie import PydanticObjectId
from beanie.operators import In

from app.models.company import Company
from app.models.role import BaseArchetype
from app.models.task import Task
from app.models.user import User, UserRole


ADMIN_LIKE_ARCHETYPES = {
    "admin",
    "hr",
    "finance",
    "it",
    "auditor",
}

MANAGEMENT_ARCHETYPES = ADMIN_LIKE_ARCHETYPES | {
    "super_admin",
    "manager",
    "assistant_manager",
}


def get_archetype_value(user: User) -> str:
    """Return the user's effective archetype as a plain string."""
    arch = user.role_archetype or user.role
    return arch.value if hasattr(arch, "value") else str(arch)


def is_super_admin(user: User) -> bool:
    return get_archetype_value(user) == BaseArchetype.SUPER_ADMIN.value


def is_management_user(user: User) -> bool:
    return get_archetype_value(user) in MANAGEMENT_ARCHETYPES


async def get_accessible_company_ids(current_user: User) -> list[PydanticObjectId]:
    """Return company IDs visible to the current user."""
    arch = get_archetype_value(current_user)

    if arch == "super_admin":
        companies = await Company.find_all().to_list()
        return [company.id for company in companies]

    if arch in ADMIN_LIKE_ARCHETYPES:
        companies = await Company.find(
            {"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}
        ).to_list()
        return [company.id for company in companies]

    return [current_user.company_id] if current_user.company_id else []


async def get_accessible_user_ids(
    current_user: User,
    *,
    include_self: bool = True,
    employee_scope: Literal["self", "company"] = "self",
) -> list[PydanticObjectId]:
    """Return user IDs visible to the current user for user search/access checks."""
    arch = get_archetype_value(current_user)

    if arch == "super_admin":
        users = await User.find(User.role != UserRole.SUPER_ADMIN.value).to_list()
        return [user.id for user in users]

    if arch in ADMIN_LIKE_ARCHETYPES:
        company_ids = await get_accessible_company_ids(current_user)
        users = await User.find(
            User.role != UserRole.SUPER_ADMIN.value,
            In(User.company_id, company_ids),
        ).to_list()
        return [user.id for user in users]

    if arch in {"manager", "assistant_manager"}:
        from app.services import user_service

        subordinates = await user_service.get_all_employees(current_user)
        ids = [employee.id for employee in subordinates]
        if include_self:
            ids.append(current_user.id)
        return ids

    if employee_scope == "company" and current_user.company_id:
        users = await User.find(
            User.role != UserRole.SUPER_ADMIN.value,
            User.company_id == current_user.company_id,
        ).to_list()
        return [user.id for user in users]

    return [current_user.id] if include_self else []


async def can_access_task(
    current_user: User,
    task: Task,
    action: Literal["read", "update", "delete", "manage"] = "read",
) -> bool:
    """Check whether a user can access a task for the requested action."""
    arch = get_archetype_value(current_user)

    if arch == "super_admin":
        return True

    if task.company_id is None:
        return task.created_by == current_user.id or task.assigned_to == current_user.id

    if arch in ADMIN_LIKE_ARCHETYPES:
        if action in {"update", "delete", "manage"}:
            permissions = await current_user.get_permissions()
            if not {"tasks:qa", "tasks:assign"}.intersection(permissions):
                return False
        company_ids = set(await get_accessible_company_ids(current_user))
        return task.company_id in company_ids

    if arch in {"manager", "assistant_manager"}:
        if task.company_id != current_user.company_id:
            return False
        if task.created_by == current_user.id or task.assigned_to == current_user.id:
            return True
        accessible_user_ids = set(await get_accessible_user_ids(current_user, include_self=True))
        return task.assigned_to in accessible_user_ids

    return task.assigned_to == current_user.id


def filter_existing_ids(ids: Iterable[Optional[PydanticObjectId]]) -> list[PydanticObjectId]:
    """Drop null IDs while preserving order."""
    return [item for item in ids if item is not None]
