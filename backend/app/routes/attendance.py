from fastapi import APIRouter, Depends, HTTPException, status
from app.models.attendance import Attendance
from app.models.user import User, UserRole
from app.auth.dependencies import get_current_user
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from beanie import PydanticObjectId
from beanie.operators import In

router = APIRouter()

class AttendanceRequest(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None
    remarks: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_reward_points: Optional[int] = 0
    company_id: str
    check_in: datetime
    check_out: Optional[datetime] = None
    location_in: Optional[dict] = None
    location_out: Optional[dict] = None
    address_in: Optional[str] = None
    address_out: Optional[str] = None
    status: str
    remarks: Optional[str] = None

@router.post("/check-in", response_model=AttendanceResponse)
async def check_in(req: AttendanceRequest, current_user: User = Depends(get_current_user)):
    """Record a check-in with live location."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await Attendance.find_one(
        Attendance.user_id == current_user.id,
        Attendance.check_in >= today_start,
        Attendance.check_out == None
    )
    if existing:
        raise HTTPException(status_code=400, detail="You are already checked in.")

    attendance = Attendance(
        user_id=current_user.id,
        company_id=current_user.company_id or current_user.id,
        location_in={"lat": req.lat, "lng": req.lng},
        address_in=req.address,
        remarks=req.remarks
    )
    await attendance.insert()
    
    res = attendance.model_dump()
    res["id"] = str(attendance.id)
    res["user_id"] = str(attendance.user_id)
    res["company_id"] = str(attendance.company_id)
    res["user_name"] = current_user.name
    res["user_email"] = current_user.email
    res["user_reward_points"] = current_user.reward_points
    return res

@router.post("/check-out", response_model=AttendanceResponse)
async def check_out(req: AttendanceRequest, current_user: User = Depends(get_current_user)):
    """Record a check-out with live location."""
    # Using find().sort().first_or_none() because FindOne doesn't support sort()
    attendance = await Attendance.find(
        Attendance.user_id == current_user.id,
        Attendance.check_out == None
    ).sort(-Attendance.check_in).first_or_none()
    
    if not attendance:
        raise HTTPException(status_code=400, detail="No active check-in session found.")

    attendance.check_out = datetime.utcnow()
    attendance.location_out = {"lat": req.lat, "lng": req.lng}
    attendance.address_out = req.address
    await attendance.save()
    
    res = attendance.model_dump()
    res["id"] = str(attendance.id)
    res["user_id"] = str(attendance.user_id)
    res["company_id"] = str(attendance.company_id)
    res["user_name"] = current_user.name
    res["user_email"] = current_user.email
    res["user_reward_points"] = current_user.reward_points
    return res

@router.get("/me", response_model=List[AttendanceResponse])
async def get_my_attendance(current_user: User = Depends(get_current_user)):
    """Retrieve check-in history for the current user."""
    logs = await Attendance.find(Attendance.user_id == current_user.id).sort(-Attendance.check_in).to_list()
    res_list = []
    for log in logs:
        res = log.model_dump()
        res["id"] = str(log.id)
        res["user_id"] = str(log.user_id)
        res["company_id"] = str(log.company_id)
        res["user_name"] = current_user.name
        res["user_email"] = current_user.email
        res["user_reward_points"] = current_user.reward_points
        res_list.append(res)
    return res_list

@router.get("/all", response_model=List[AttendanceResponse])
async def get_all_attendance(current_user: User = Depends(get_current_user)):
    """Retrieve attendance logs for management with user names."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Unauthorized access to attendance logs.")
    
    if current_user.role == UserRole.SUPER_ADMIN:
        logs = await Attendance.find_all().sort(-Attendance.check_in).to_list()
    else:
        logs = await Attendance.find(Attendance.company_id == current_user.company_id).sort(-Attendance.check_in).to_list()
    
    # Fetch all user names in one go to be efficient
    user_ids = list(set([log.user_id for log in logs]))
    if not user_ids:
        return []
        
    users = await User.find(In(User.id, user_ids)).to_list()
    user_map = {str(u.id): {"name": u.name, "email": u.email, "reward_points": u.reward_points} for u in users}
    
    res_list = []
    for log in logs:
        res = log.model_dump()
        res["id"] = str(log.id)
        res["user_id"] = str(log.user_id)
        res["company_id"] = str(log.company_id)
        user_info = user_map.get(str(log.user_id), {})
        res["user_name"] = user_info.get("name", "Unknown User")
        res["user_email"] = user_info.get("email")
        res["user_reward_points"] = user_info.get("reward_points", 0)
        res_list.append(res)
    return res_list
