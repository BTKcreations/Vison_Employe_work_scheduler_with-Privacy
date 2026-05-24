"""
Company management routes - admin CRUD + public list for dropdowns.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.company import Company
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from beanie import PydanticObjectId

router = APIRouter(prefix="/companies", tags=["Company Management"])


def _validate_time_str(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    import re
    raw = v.strip().upper()
    m = re.match(r"^(\d{1,2})[-:.](\d{2})\s*(AM|PM)?$", raw)
    if not m:
        raise ValueError("Time must match format HH:MM AM/PM or HH:MM (e.g., '09:30 AM', '14:00')")
    hour = int(m.group(1))
    minute = int(m.group(2))
    if not (0 <= hour <= 23) or not (0 <= minute <= 59):
        raise ValueError("Hours must be 0-23 and minutes 0-59")
    return v


class CreateCompanyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    work_days: Optional[List[str]] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    work_type: Optional[str] = "fixed"
    flexible_hours: Optional[int] = 8
    cut_out_time: Optional[str] = "10:00"
    owner_id: Optional[str] = None
    
    subscription_max_employees: Optional[int] = Field(None, description="Super Admin only")
    subscription_max_roles: Optional[int] = Field(None, description="Super Admin only")
    subscription_geofencing: Optional[bool] = Field(None, description="Super Admin only")

    @field_validator("work_start_time", "work_end_time", "cut_out_time")
    @classmethod
    def validate_time_fields(cls, v):
        return _validate_time_str(v)


class UpdateCompanyRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None
    work_days: Optional[List[str]] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    work_type: Optional[str] = None
    flexible_hours: Optional[int] = None
    cut_out_time: Optional[str] = None
    owner_id: Optional[str] = None
    
    subscription_max_employees: Optional[int] = Field(None, description="Super Admin only")
    subscription_max_roles: Optional[int] = Field(None, description="Super Admin only")
    subscription_geofencing: Optional[bool] = Field(None, description="Super Admin only")

    @field_validator("work_start_time", "work_end_time", "cut_out_time")
    @classmethod
    def validate_time_fields(cls, v):
        return _validate_time_str(v)


class CompanyResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_active: bool
    work_days: List[str]
    work_start_time: str
    work_end_time: str
    work_type: str
    flexible_hours: int
    cut_out_time: str
    created_at: str
    owner_id: Optional[str] = None
    subscription_max_employees: Optional[int] = 10
    subscription_max_roles: Optional[int] = 3
    subscription_geofencing: Optional[bool] = True


@router.get("", response_model=List[CompanyResponse])
async def list_companies(current_user: User = Depends(get_current_user)):
    """List all active companies scoped by user role/company ownership."""
    from app.models.user import UserRole
    if current_user.role == UserRole.SUPER_ADMIN:
        companies = await Company.find(Company.is_active == True).sort("name").to_list()
    elif current_user.role == UserRole.ADMIN:
        companies = await Company.find(
            Company.is_active == True,
            {"$or": [
                {"owner_id": current_user.id},
                {"_id": current_user.company_id}
            ]}
        ).sort("name").to_list()
    else:
        if current_user.company_id:
            companies = await Company.find(
                Company.is_active == True,
                Company.id == current_user.company_id
            ).sort("name").to_list()
        else:
            companies = []

    return [
        CompanyResponse(
            id=str(c.id),
            name=c.name,
            description=c.description,
            is_active=c.is_active,
            work_days=c.work_days,
            work_start_time=c.work_start_time,
            work_end_time=c.work_end_time,
            work_type=c.work_type,
            flexible_hours=c.flexible_hours,
            cut_out_time=c.cut_out_time,
            created_at=c.created_at.isoformat() + 'Z',
            owner_id=str(c.owner_id) if c.owner_id else None,
            subscription_max_employees=getattr(c, 'subscription_max_employees', 10),
            subscription_max_roles=getattr(c, 'subscription_max_roles', 3),
            subscription_geofencing=getattr(c, 'subscription_geofencing', True),
        )
        for c in companies
    ]


@router.get("/all", response_model=List[CompanyResponse])
async def list_all_companies(admin: User = Depends(require_admin)):
    """List all companies including inactive (admin only)."""
    from app.models.user import UserRole
    if admin.role == UserRole.SUPER_ADMIN:
        companies = await Company.find().sort("-created_at").to_list()
    else:
        companies = await Company.find(
            {"$or": [
                {"owner_id": admin.id},
                {"_id": admin.company_id}
            ]}
        ).sort("-created_at").to_list()
    return [
        CompanyResponse(
            id=str(c.id),
            name=c.name,
            description=c.description,
            is_active=c.is_active,
            work_days=c.work_days,
            work_start_time=c.work_start_time,
            work_end_time=c.work_end_time,
            work_type=c.work_type,
            flexible_hours=c.flexible_hours,
            cut_out_time=c.cut_out_time,
            created_at=c.created_at.isoformat() + 'Z',
            owner_id=str(c.owner_id) if c.owner_id else None,
            subscription_max_employees=getattr(c, 'subscription_max_employees', 10),
            subscription_max_roles=getattr(c, 'subscription_max_roles', 3),
            subscription_geofencing=getattr(c, 'subscription_geofencing', True),
        )
        for c in companies
    ]


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    request: CreateCompanyRequest,
    admin: User = Depends(require_admin),
):
    """Create a new company/department (admin creates for self, super_admin must assign to a tenant)."""
    existing = await Company.find_one(Company.name == request.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company with this name already exists",
        )

    from app.models.user import UserRole
    if admin.role == UserRole.SUPER_ADMIN:
        # Super admin must specify which tenant admin owns this company
        if not request.owner_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Super admin must specify an owner_id (tenant admin) when creating a company",
            )
        # Validate the owner is an actual admin user
        owner = await User.get(PydanticObjectId(request.owner_id))
        if not owner or owner.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="owner_id must refer to an existing tenant admin user",
            )
        owner_id = PydanticObjectId(request.owner_id)
    else:
        # Tenant admin: auto-bind to themselves
        owner_id = admin.id

    company = Company(
        name=request.name,
        description=request.description,
        owner_id=owner_id,
        work_days=request.work_days or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        work_start_time=request.work_start_time or "09:00",
        work_end_time=request.work_end_time or "18:00",
        work_type=request.work_type or "fixed",
        flexible_hours=request.flexible_hours or 8,
        cut_out_time=request.cut_out_time or "10:00",
        subscription_max_employees=request.subscription_max_employees if admin.role == UserRole.SUPER_ADMIN and request.subscription_max_employees is not None else 10,
        subscription_max_roles=request.subscription_max_roles if admin.role == UserRole.SUPER_ADMIN and request.subscription_max_roles is not None else 3,
        subscription_geofencing=request.subscription_geofencing if admin.role == UserRole.SUPER_ADMIN and request.subscription_geofencing is not None else True,
    )
    await company.insert()

    # Auto-assign company_id to tenant admin if not already set
    if admin.role == UserRole.ADMIN and not admin.company_id:
        admin.company_id = company.id
        await admin.save()

    return CompanyResponse(
        id=str(company.id),
        name=company.name,
        description=company.description,
        is_active=company.is_active,
        work_days=company.work_days,
        work_start_time=company.work_start_time,
        work_end_time=company.work_end_time,
        work_type=company.work_type,
        flexible_hours=company.flexible_hours,
        cut_out_time=company.cut_out_time,
        created_at=company.created_at.isoformat() + 'Z',
        owner_id=str(company.owner_id) if company.owner_id else None,
        subscription_max_employees=getattr(company, 'subscription_max_employees', 10),
        subscription_max_roles=getattr(company, 'subscription_max_roles', 3),
        subscription_geofencing=getattr(company, 'subscription_geofencing', True),
    )


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    request: UpdateCompanyRequest,
    admin: User = Depends(require_admin),
):
    """Update a company (admin only)."""
    company = await Company.get(PydanticObjectId(company_id))
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    from app.models.user import UserRole
    if admin.role != UserRole.SUPER_ADMIN:
        if company.owner_id != admin.id and company.id != admin.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this company",
            )

    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    if "owner_id" in update_data:
        update_data["owner_id"] = PydanticObjectId(update_data["owner_id"]) if update_data["owner_id"] else None
        
    # Protect subscription fields from Tenant Admins
    if admin.role != UserRole.SUPER_ADMIN:
        update_data.pop("subscription_max_employees", None)
        update_data.pop("subscription_max_roles", None)
        update_data.pop("subscription_geofencing", None)

    if update_data:
        await company.set(update_data)
        company = await Company.get(PydanticObjectId(company_id))

    return CompanyResponse(
        id=str(company.id),
        name=company.name,
        description=company.description,
        is_active=company.is_active,
        work_days=company.work_days,
        work_start_time=company.work_start_time,
        work_end_time=company.work_end_time,
        work_type=company.work_type,
        flexible_hours=company.flexible_hours,
        cut_out_time=company.cut_out_time,
        created_at=company.created_at.isoformat() + 'Z',
        owner_id=str(company.owner_id) if company.owner_id else None,
        subscription_max_employees=getattr(company, 'subscription_max_employees', 10),
        subscription_max_roles=getattr(company, 'subscription_max_roles', 3),
        subscription_geofencing=getattr(company, 'subscription_geofencing', True),
    )


@router.delete("/{company_id}")
async def delete_company(
    company_id: str,
    admin: User = Depends(require_admin),
):
    """Deactivate a company (admin only)."""
    company = await Company.get(PydanticObjectId(company_id))
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    from app.models.user import UserRole
    if admin.role != UserRole.SUPER_ADMIN:
        if company.owner_id != admin.id and company.id != admin.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this company",
            )

    await company.set({"is_active": False})
    return {"message": f"Company '{company.name}' deactivated"}
