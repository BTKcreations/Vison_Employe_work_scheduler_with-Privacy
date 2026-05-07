"""
Company management routes - admin CRUD + public list for dropdowns.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.company import Company
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/companies", tags=["Company Management"])


class CreateCompanyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)


class UpdateCompanyRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class CompanyResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_active: bool
    created_at: str


@router.get("", response_model=List[CompanyResponse])
async def list_companies(current_user: User = Depends(get_current_user)):
    """List all active companies (available to all authenticated users for dropdowns)."""
    companies = await Company.find(Company.is_active == True).sort("name").to_list()
    return [
        CompanyResponse(
            id=str(c.id),
            name=c.name,
            description=c.description,
            is_active=c.is_active,
            created_at=c.created_at.isoformat() + 'Z',
        )
        for c in companies
    ]


@router.get("/all", response_model=List[CompanyResponse])
async def list_all_companies(admin: User = Depends(require_admin)):
    """List all companies including inactive (admin only)."""
    companies = await Company.find().sort("-created_at").to_list()
    return [
        CompanyResponse(
            id=str(c.id),
            name=c.name,
            description=c.description,
            is_active=c.is_active,
            created_at=c.created_at.isoformat() + 'Z',
        )
        for c in companies
    ]


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    request: CreateCompanyRequest,
    admin: User = Depends(require_admin),
):
    """Create a new company (admin only)."""
    # Check for duplicate name
    existing = await Company.find_one(Company.name == request.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company with this name already exists",
        )

    company = Company(
        name=request.name,
        description=request.description,
    )
    await company.insert()

    return CompanyResponse(
        id=str(company.id),
        name=company.name,
        description=company.description,
        is_active=company.is_active,
        created_at=company.created_at.isoformat() + 'Z',
    )


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    request: UpdateCompanyRequest,
    admin: User = Depends(require_admin),
):
    """Update a company (admin only)."""
    from beanie import PydanticObjectId
    company = await Company.get(PydanticObjectId(company_id))
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    if update_data:
        await company.set(update_data)
        company = await Company.get(PydanticObjectId(company_id))

    return CompanyResponse(
        id=str(company.id),
        name=company.name,
        description=company.description,
        is_active=company.is_active,
        created_at=company.created_at.isoformat() + 'Z',
    )


@router.delete("/{company_id}")
async def delete_company(
    company_id: str,
    admin: User = Depends(require_admin),
):
    """Deactivate a company (admin only)."""
    from beanie import PydanticObjectId
    company = await Company.get(PydanticObjectId(company_id))
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    await company.set({"is_active": False})
    return {"message": f"Company '{company.name}' deactivated"}
