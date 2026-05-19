"""
Holiday management routes.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.holiday import Holiday
from app.models.user import User, UserRole
from app.auth.dependencies import get_current_user, require_admin
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from beanie import PydanticObjectId

router = APIRouter(tags=["Holiday Management"])

class HolidayRequest(BaseModel):
    name: str
    date: datetime
    company_id: Optional[str] = None

class HolidayResponse(BaseModel):
    id: str
    name: str
    date: datetime
    company_id: Optional[str] = None
    created_at: datetime

@router.get("", response_model=List[HolidayResponse])
async def list_holidays(current_user: User = Depends(get_current_user)):
    """List holidays scoped to user's permissions/hierarchy."""
    global_holidays = await Holiday.find(Holiday.company_id == None).to_list()
    company_holidays = []
    
    if current_user.role == UserRole.SUPER_ADMIN:
        company_holidays = await Holiday.find(Holiday.company_id != None).to_list()
    elif current_user.role == UserRole.ADMIN:
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = [c.id for c in companies]
        from beanie.operators import In
        company_holidays = await Holiday.find(In(Holiday.company_id, co_ids)).to_list()
    else:
        if current_user.company_id:
            company_holidays = await Holiday.find(Holiday.company_id == current_user.company_id).to_list()
    
    holidays = sorted(global_holidays + company_holidays, key=lambda x: x.date)
    
    return [
        HolidayResponse(
            id=str(h.id),
            name=h.name,
            date=h.date,
            company_id=str(h.company_id) if h.company_id else None,
            created_at=h.created_at
        ) for h in holidays
    ]

@router.post("", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
async def create_holiday(req: HolidayRequest, current_user: User = Depends(get_current_user)):
    """Create a new holiday."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if current_user.role == UserRole.SUPER_ADMIN:
        company_id = PydanticObjectId(req.company_id) if req.company_id else None
    else:
        # Admin role
        if not req.company_id:
            if not current_user.company_id:
                raise HTTPException(status_code=400, detail="Company ID must be specified")
            company_id = current_user.company_id
        else:
            company_id = PydanticObjectId(req.company_id)
        
        # Check authorization
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if company_id not in co_ids:
            raise HTTPException(status_code=403, detail="Not authorized to create a holiday for this company")
    
    holiday = Holiday(
        name=req.name,
        date=req.date,
        company_id=company_id
    )
    await holiday.insert()
    
    return HolidayResponse(
        id=str(holiday.id),
        name=holiday.name,
        date=holiday.date,
        company_id=str(holiday.company_id) if holiday.company_id else None,
        created_at=holiday.created_at
    )

@router.delete("/{holiday_id}")
async def delete_holiday(holiday_id: str, current_user: User = Depends(get_current_user)):
    """Delete a holiday."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    holiday = await Holiday.get(PydanticObjectId(holiday_id))
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    if current_user.role != UserRole.SUPER_ADMIN:
        if not holiday.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete a global holiday")
        
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if holiday.company_id not in co_ids:
            raise HTTPException(status_code=403, detail="Not authorized to delete holidays for this company")
        
    await holiday.delete()
    return {"message": "Holiday deleted"}
