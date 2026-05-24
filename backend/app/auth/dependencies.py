"""
FastAPI dependencies for authentication and authorization.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.jwt_handler import decode_access_token
from app.models.user import User, UserRole
from beanie import PydanticObjectId
from typing import List

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """Extract and validate the current user from JWT token."""
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await User.get(PydanticObjectId(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


class RoleChecker:
    """Dependency factory for checking if a user has specific roles based on archetypes."""
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        from app.models.role import BaseArchetype

        arch = user.role_archetype or user.role
        # Check if the archetype matches the allowed role values
        allowed_values = [r.value for r in self.allowed_roles]
        if arch not in allowed_values and user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_values}",
            )
        return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user is an admin or super admin archetype."""
    from app.models.role import BaseArchetype

    arch = current_user.role_archetype or current_user.role
    if arch not in [BaseArchetype.ADMIN, BaseArchetype.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_management(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user is a management archetype (admin, super admin, manager, assistant manager, or hr)."""
    from app.models.role import BaseArchetype

    arch = current_user.role_archetype or current_user.role
    allowed_management = [
        BaseArchetype.ADMIN, BaseArchetype.SUPER_ADMIN, 
        BaseArchetype.MANAGER, BaseArchetype.ASSISTANT_MANAGER,
        BaseArchetype.HR, BaseArchetype.IT, BaseArchetype.FINANCE, BaseArchetype.AUDITOR,
        UserRole.ADMIN, UserRole.SUPER_ADMIN,
        UserRole.MANAGER, UserRole.ASSISTANT_MANAGER,
        UserRole.HR, UserRole.IT, UserRole.FINANCE, UserRole.AUDITOR
    ]
    if arch not in allowed_management:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Management access required",
        )
    return current_user


class PermissionChecker:
    """Dependency checking if the user has a specific atomic permission."""
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    async def __call__(self, user: User = Depends(get_current_user)) -> User:
        from app.models.role import BaseArchetype, CompanyRole, get_default_permissions_for_archetype

        arch = user.role_archetype or user.role
        # Super admin always bypasses all permission checks
        if arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
            return user

        permissions = []
        if user.role_id:
            role = await CompanyRole.get(user.role_id)
            if role:
                permissions = role.permissions
        else:
            # Fallback to default archetype permissions
            permissions = get_default_permissions_for_archetype(arch)

        if self.required_permission in permissions:
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Missing required permission: {self.required_permission}",
        )


async def has_permission(user: User, permission: str) -> bool:
    """Helper to check if a user has a specific permission (with fallback to defaults)."""
    from app.models.role import BaseArchetype, CompanyRole, get_default_permissions_for_archetype

    arch = user.role_archetype or user.role
    if arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
        return True

    permissions = []
    if user.role_id:
        role = await CompanyRole.get(user.role_id)
        if role:
            permissions = role.permissions
    else:
        permissions = get_default_permissions_for_archetype(arch)

    return permission in permissions


