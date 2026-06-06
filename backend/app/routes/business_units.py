"""
BusinessUnit routes - CRUD for business units within a tenant.

Tenant admins (ADMIN role with a non-null tenant_id) can manage business
units in their own tenant. Platform owners get a read-only view across all
tenants (used by the owner panel for tenant detail pages).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from beanie import PydanticObjectId

from app.auth.dependencies import get_current_user, require_admin, require_platform_owner
from app.models.user import User
from app.models.business_unit import BusinessUnit, BUSINESS_UNIT_TYPES
from app.services import business_unit_service
from app.schemas.business_unit import (
    BusinessUnitCreate,
    BusinessUnitUpdate,
    BusinessUnitResponse,
    BusinessUnitListResponse,
)

router = APIRouter(prefix="/business-units", tags=["Business Units"])


def _to_response(unit: BusinessUnit, employee_count: int = 0) -> BusinessUnitResponse:
    return BusinessUnitResponse(
        id=str(unit.id),
        tenant_id=str(unit.tenant_id),
        company_id=str(unit.company_id),
        name=unit.name,
        type=unit.type,
        code=unit.code,
        description=unit.description,
        is_active=unit.is_active,
        is_default=unit.is_default,
        address=unit.address,
        city=unit.city,
        state=unit.state,
        country=unit.country,
        timezone=unit.timezone,
        currency=unit.currency,
        contact_email=unit.contact_email,
        contact_phone=unit.contact_phone,
        work_days=unit.work_days,
        work_start_time=unit.work_start_time,
        work_end_time=unit.work_end_time,
        employee_count=employee_count,
        created_at=unit.created_at,
        updated_at=unit.updated_at,
    )


@router.get("", response_model=BusinessUnitListResponse)
async def list_my_business_units(
    include_inactive: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
):
    """List business units in the caller's tenant. Tenant admin or any tenant user."""
    if current_user.is_platform_owner or current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business units belong to a tenant.",
        )
    units = await business_unit_service.list_business_units(
        current_user.tenant_id,
        include_inactive=include_inactive,
    )
    items = []
    for u in units:
        count = await business_unit_service.count_employees_in_unit(u.id)
        items.append(_to_response(u, count))
    return BusinessUnitListResponse(items=items, total=len(items))


@router.post("", response_model=BusinessUnitResponse, status_code=status.HTTP_201_CREATED)
async def create_business_unit(
    body: BusinessUnitCreate,
    current_user: User = Depends(require_admin),
):
    """Create a new business unit within the caller's tenant."""
    await business_unit_service._ensure_tenant_admin(current_user)
    company_id = body.company_id or current_user.primary_company_id
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create a business unit before the tenant has a Company. Create a Company first from /admin/companies.",
        )
    unit = await business_unit_service.create_business_unit(
        tenant_id=current_user.tenant_id,
        company_id=company_id,
        name=body.name,
        type=body.type,
        code=body.code,
        description=body.description,
        address=body.address,
        city=body.city,
        state=body.state,
        country=body.country,
        timezone=body.timezone,
        currency=body.currency,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        work_days=body.work_days,
        work_start_time=body.work_start_time,
        work_end_time=body.work_end_time,
        is_default=body.is_default,
    )
    return _to_response(unit, 0)


@router.get("/{unit_id}", response_model=BusinessUnitResponse)
async def get_business_unit(
    unit_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a single business unit. Caller must be in the same tenant."""
    if current_user.is_platform_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform owners don't manage individual business units.",
        )
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenant context.",
        )
    try:
        oid = PydanticObjectId(unit_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid unit id.")
    unit = await business_unit_service.get_business_unit(current_user.tenant_id, oid)
    count = await business_unit_service.count_employees_in_unit(unit.id)
    return _to_response(unit, count)


@router.patch("/{unit_id}", response_model=BusinessUnitResponse)
async def update_business_unit(
    unit_id: str,
    body: BusinessUnitUpdate,
    current_user: User = Depends(require_admin),
):
    await business_unit_service._ensure_tenant_admin(current_user)
    try:
        oid = PydanticObjectId(unit_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid unit id.")
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    unit = await business_unit_service.update_business_unit(
        current_user.tenant_id, oid, patch
    )
    count = await business_unit_service.count_employees_in_unit(unit.id)
    return _to_response(unit, count)


@router.post("/{unit_id}/deactivate", response_model=BusinessUnitResponse)
async def deactivate_business_unit(
    unit_id: str,
    current_user: User = Depends(require_admin),
):
    await business_unit_service._ensure_tenant_admin(current_user)
    try:
        oid = PydanticObjectId(unit_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid unit id.")
    unit = await business_unit_service.deactivate_business_unit(
        current_user.tenant_id, oid
    )
    count = await business_unit_service.count_employees_in_unit(unit.id)
    return _to_response(unit, count)


@router.post("/{unit_id}/activate", response_model=BusinessUnitResponse)
async def activate_business_unit(
    unit_id: str,
    current_user: User = Depends(require_admin),
):
    await business_unit_service._ensure_tenant_admin(current_user)
    try:
        oid = PydanticObjectId(unit_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid unit id.")
    unit = await business_unit_service.activate_business_unit(
        current_user.tenant_id, oid
    )
    count = await business_unit_service.count_employees_in_unit(unit.id)
    return _to_response(unit, count)


@router.get("/types/all", response_model=List[str])
async def list_business_unit_types(
    current_user: User = Depends(get_current_user),
):
    """Return the available business unit types. Open to any authenticated user."""
    return BUSINESS_UNIT_TYPES
