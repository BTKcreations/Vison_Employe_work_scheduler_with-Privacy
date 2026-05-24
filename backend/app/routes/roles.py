from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.role import CompanyRole, BaseArchetype, get_default_permissions_for_archetype
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse
from beanie import PydanticObjectId
from typing import List

router = APIRouter(prefix="/roles", tags=["Role Management"])


@router.get("", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(get_current_user),
):
    """List all custom roles for the tenant's company, plus global base templates."""
    from beanie.operators import Or

    company_id = current_user.company_id
    query = Or(
        CompanyRole.company_id == company_id,
        CompanyRole.company_id == None
    )
    roles = await CompanyRole.find(query).to_list()

    return [RoleResponse.from_role(r) for r in roles]


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: RoleCreate,
    current_user: User = Depends(require_admin),
):
    """Create a new custom role for the tenant."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a company to create custom roles",
        )

    # Check if a custom role with same display name already exists for this tenant
    existing = await CompanyRole.find_one(
        CompanyRole.company_id == current_user.company_id,
        CompanyRole.display_name == request.display_name
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A role named '{request.display_name}' already exists",
        )

    # Prevent custom super_admin roles
    if request.base_archetype == BaseArchetype.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create custom roles based on the Super Admin archetype",
        )

    # SaaS Plan Verification: Check max custom roles limit
    from app.models.company import Company
    comp_obj = await Company.get(current_user.company_id)
    if comp_obj:
        max_roles = getattr(comp_obj, "subscription_max_roles", 3)
        if max_roles > 0:
            current_roles_count = await CompanyRole.find(CompanyRole.company_id == current_user.company_id).count()
            if current_roles_count >= max_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Subscription Limit Reached: Your plan allows a maximum of {max_roles} custom roles."
                )

    # If permissions are empty, populate with default archetype permissions
    perms = request.permissions
    if not perms:
        perms = get_default_permissions_for_archetype(request.base_archetype)

    new_role = CompanyRole(
        company_id=current_user.company_id,
        display_name=request.display_name,
        base_archetype=request.base_archetype,
        permissions=perms,
        is_custom=True
    )
    await new_role.insert()
    return RoleResponse.from_role(new_role)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    request: RoleUpdate,
    current_user: User = Depends(require_admin),
):
    """Update a custom role's display name and/or permissions."""
    try:
        role = await CompanyRole.get(PydanticObjectId(role_id))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    if not role or role.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found or not belonging to your company",
        )

    if not role.is_custom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System base roles cannot be modified",
        )

    # Check name collision if renaming
    if request.display_name and request.display_name != role.display_name:
        existing = await CompanyRole.find_one(
            CompanyRole.company_id == current_user.company_id,
            CompanyRole.display_name == request.display_name
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A role named '{request.display_name}' already exists",
            )
        role.display_name = request.display_name

    if request.permissions is not None:
        role.permissions = request.permissions

    await role.save()

    # Update display name on all users holding this role
    await User.find(User.role_id == role.id).set({User.role_display_name: role.display_name})

    return RoleResponse.from_role(role)


@router.delete("/{role_id}")
async def delete_role(
    role_id: str,
    current_user: User = Depends(require_admin),
):
    """Delete a custom role. Cannot delete if users are assigned to it."""
    try:
        role = await CompanyRole.get(PydanticObjectId(role_id))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    if not role or role.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found or not belonging to your company",
        )

    if not role.is_custom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System base roles cannot be deleted",
        )

    # Check if any user is currently assigned to this role
    assigned_users_count = await User.find(User.role_id == role.id).count()
    if assigned_users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role. There are {assigned_users_count} user(s) assigned to it.",
        )

    await role.delete()
    return {"message": f"Role '{role.display_name}' deleted successfully"}
