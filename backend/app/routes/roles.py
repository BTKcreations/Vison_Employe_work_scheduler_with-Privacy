from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user, require_admin, PermissionChecker
from app.models.user import User
from app.models.role import CompanyRole, BaseArchetype, get_default_permissions_for_archetype, resolve_effective_permissions_for_role
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse
from beanie import PydanticObjectId
from typing import List

router = APIRouter(prefix="/roles", tags=["Role Management"])


async def _validate_parent_roles(company_id, role_ids: List[str], current_role_id: str | None = None) -> List[PydanticObjectId]:
    resolved = []
    for rid in role_ids:
        try:
            oid = PydanticObjectId(rid)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid parent role id: {rid}")
        role = await CompanyRole.get(oid)
        if not role:
            raise HTTPException(status_code=404, detail=f"Parent role not found: {rid}")
        if role.company_id not in [company_id, None]:
            raise HTTPException(status_code=403, detail="Parent role must belong to your company or system templates.")
        if current_role_id and str(role.id) == str(current_role_id):
            raise HTTPException(status_code=400, detail="Role cannot be parent of itself.")
        resolved.append(oid)

    # cycle prevention on updates
    if current_role_id:
        current_oid = PydanticObjectId(current_role_id)

        async def has_path_to_current(role_obj: CompanyRole) -> bool:
            stack = list(role_obj.parent_role_ids or [])
            seen = set()
            while stack:
                nid = stack.pop()
                if nid in seen:
                    continue
                seen.add(nid)
                if nid == current_oid:
                    return True
                nrole = await CompanyRole.get(nid)
                if nrole:
                    stack.extend(nrole.parent_role_ids or [])
            return False

        for oid in resolved:
            parent_role = await CompanyRole.get(oid)
            if parent_role and await has_path_to_current(parent_role):
                raise HTTPException(status_code=400, detail="Role parent hierarchy cannot contain cycles.")
    return resolved


@router.get("", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(PermissionChecker("roles:manage")),
):
    """List all custom roles for the tenant's company, plus global base templates."""
    from beanie.operators import Or

    company_id = current_user.company_id
    query = Or(
        CompanyRole.company_id == company_id,
        CompanyRole.company_id == None
    )
    roles = await CompanyRole.find(query).to_list()

    output = []
    for r in roles:
        dto = RoleResponse.from_role(r)
        dto.effective_permissions = await resolve_effective_permissions_for_role(r)
        output.append(dto)
    return output


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: RoleCreate,
    current_user: User = Depends(PermissionChecker("roles:manage")),
):
    """Create a new custom role for the tenant."""
    from app.models.user import UserRole
    is_super_admin = current_user.role == UserRole.SUPER_ADMIN
    target_company_id = None if is_super_admin and request.is_template else current_user.company_id

    if not target_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a company to create custom roles (or super admin must create global template with is_template=true)",
        )

    # Check if a custom role with same display name already exists for this tenant
    existing = await CompanyRole.find_one(
        CompanyRole.company_id == target_company_id,
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

    # SaaS Plan Verification: Check max custom roles limit (tenant only)
    if not is_super_admin or target_company_id is not None:
        from app.models.company import Company
        comp_obj = await Company.get(target_company_id)
        if comp_obj:
            max_roles = getattr(comp_obj, "subscription_max_roles", 3)
            if max_roles > 0:
                current_roles_count = await CompanyRole.find(CompanyRole.company_id == target_company_id).count()
                if current_roles_count >= max_roles:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Subscription Limit Reached: Your plan allows a maximum of {max_roles} custom roles."
                    )

    # Optional template cloning support (company role or global template)
    template_role = None
    if request.template_role_id:
        try:
            template_role = await CompanyRole.get(PydanticObjectId(request.template_role_id))
        except Exception:
            template_role = None
        if not template_role:
            raise HTTPException(status_code=404, detail="Template role not found")
        if template_role.company_id not in [None, target_company_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Template role is outside your company scope",
            )

    # If permissions are empty, populate from template, else default archetype permissions
    perms = request.permissions
    denied_perms = request.denied_permissions
    parent_ids = request.parent_role_ids
    if template_role:
        if not perms:
            perms = template_role.permissions or []
        if not denied_perms:
            denied_perms = template_role.denied_permissions or []
        if not parent_ids:
            parent_ids = [str(x) for x in (template_role.parent_role_ids or [])]
    elif not perms:
        perms = get_default_permissions_for_archetype(request.base_archetype)

    new_role = CompanyRole(
        company_id=target_company_id,
        display_name=request.display_name,
        base_archetype=request.base_archetype,
        permissions=perms,
        denied_permissions=denied_perms,
        parent_role_ids=await _validate_parent_roles(target_company_id, parent_ids),
        is_template=request.is_template,
        is_custom=True
    )
    await new_role.insert()
    dto = RoleResponse.from_role(new_role)
    dto.effective_permissions = await resolve_effective_permissions_for_role(new_role)
    return dto


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    request: RoleUpdate,
    current_user: User = Depends(PermissionChecker("roles:manage")),
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
    if request.denied_permissions is not None:
        role.denied_permissions = request.denied_permissions
    if request.parent_role_ids is not None:
        role.parent_role_ids = await _validate_parent_roles(current_user.company_id, request.parent_role_ids, role_id)

    await role.save()

    # Update display name on all users holding this role
    await User.find(User.role_id == role.id).set({User.role_display_name: role.display_name})

    dto = RoleResponse.from_role(role)
    dto.effective_permissions = await resolve_effective_permissions_for_role(role)
    return dto


@router.get("/templates", response_model=List[RoleResponse])
async def list_role_templates(current_user: User = Depends(PermissionChecker("roles:manage"))):
    """List role templates available to this tenant (global + company templates)."""
    from beanie.operators import Or
    from app.models.user import UserRole

    if current_user.role == UserRole.SUPER_ADMIN:
        roles = await CompanyRole.find(CompanyRole.is_template == True).to_list()
    else:
        roles = await CompanyRole.find(
            Or(CompanyRole.company_id == current_user.company_id, CompanyRole.company_id == None),
            CompanyRole.is_template == True
        ).to_list()

    output = []
    for r in roles:
        dto = RoleResponse.from_role(r)
        dto.effective_permissions = await resolve_effective_permissions_for_role(r)
        output.append(dto)
    return output


@router.post("/templates/{role_id}", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def clone_role_as_template(
    role_id: str,
    current_user: User = Depends(PermissionChecker("roles:manage")),
):
    """Clone an existing role into a company template for reuse."""
    try:
        source = await CompanyRole.get(PydanticObjectId(role_id))
    except Exception:
        source = None
    if not source:
        raise HTTPException(status_code=404, detail="Source role not found")
    if source.company_id not in [None, current_user.company_id]:
        raise HTTPException(status_code=403, detail="Source role is outside your scope")

    cloned_name = f"{source.display_name} Template"
    existing = await CompanyRole.find_one(
        CompanyRole.company_id == current_user.company_id,
        CompanyRole.display_name == cloned_name
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Template '{cloned_name}' already exists")

    clone = CompanyRole(
        company_id=current_user.company_id,
        display_name=cloned_name,
        base_archetype=source.base_archetype,
        permissions=source.permissions or [],
        denied_permissions=source.denied_permissions or [],
        parent_role_ids=source.parent_role_ids or [],
        is_template=True,
        is_custom=True
    )
    await clone.insert()

    dto = RoleResponse.from_role(clone)
    dto.effective_permissions = await resolve_effective_permissions_for_role(clone)
    return dto


@router.delete("/{role_id}")
async def delete_role(
    role_id: str,
    current_user: User = Depends(PermissionChecker("roles:manage")),
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
@router.post("/templates/seed-defaults", response_model=List[RoleResponse], status_code=status.HTTP_201_CREATED)
async def seed_global_role_templates(current_user: User = Depends(PermissionChecker("roles:manage"))):
    """Seed a curated set of global role templates. Super Admin only."""
    from app.models.user import UserRole
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only super admins can seed global templates")

    template_specs = [
        ("HR Ops Template", BaseArchetype.HR),
        ("Finance Ops Template", BaseArchetype.FINANCE),
        ("Project Manager Template", BaseArchetype.MANAGER),
        ("Field Supervisor Template", BaseArchetype.ASSISTANT_MANAGER),
        ("Auditor Template", BaseArchetype.AUDITOR),
    ]

    created: list[CompanyRole] = []
    for display_name, archetype in template_specs:
        existing = await CompanyRole.find_one(
            CompanyRole.company_id == None,
            CompanyRole.display_name == display_name
        )
        if existing:
            created.append(existing)
            continue
        role = CompanyRole(
            company_id=None,
            display_name=display_name,
            base_archetype=archetype,
            permissions=get_default_permissions_for_archetype(archetype),
            denied_permissions=[],
            parent_role_ids=[],
            is_template=True,
            is_custom=False,
        )
        await role.insert()
        created.append(role)

    output: list[RoleResponse] = []
    for r in created:
        dto = RoleResponse.from_role(r)
        dto.effective_permissions = await resolve_effective_permissions_for_role(r)
        output.append(dto)
    return output
