"""
API Routes for Peer Recognition / Collaboration System.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from beanie import PydanticObjectId
from app.models.peer_recognition import PeerRecognition
from app.models.user import User
from app.auth.dependencies import get_current_user
from pydantic import BaseModel, Field
from datetime import datetime

router = APIRouter(prefix="/peer-recognition", tags=["Peer Recognition"])

class RecognitionRequest(BaseModel):
    receiver_id: str
    reason: str = Field(..., min_length=5, max_length=500)
    points: float = Field(default=1.0, gt=0.0, le=10.0)

@router.post("", response_model=dict)
async def give_recognition(req: RecognitionRequest, current_user: User = Depends(get_current_user)):
    """Award micro-points to a peer."""
    if str(current_user.id) == req.receiver_id:
        raise HTTPException(status_code=400, detail="You cannot recognize yourself.")
    
    receiver = await User.get(PydanticObjectId(req.receiver_id))
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found.")
    
    if receiver.company_id != current_user.company_id:
        raise HTTPException(status_code=400, detail="Users must be in the same company.")

    # Check capping logic (max 10 points per month sent)
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    sent_this_month = await PeerRecognition.find(
        PeerRecognition.sender_id == current_user.id,
        PeerRecognition.created_at >= start_of_month
    ).to_list()

    total_sent = sum(r.points for r in sent_this_month)
    if total_sent + req.points > 10.0:
        raise HTTPException(status_code=400, detail="You have exceeded your peer recognition limit for this month (10 points max).")

    # Insert recognition
    recognition = PeerRecognition(
        sender_id=current_user.id,
        sender_name=current_user.name,
        receiver_id=receiver.id,
        receiver_name=receiver.name,
        company_id=current_user.company_id,
        points=req.points,
        reason=req.reason
    )
    await recognition.insert()

    # Add points to receiver
    await receiver.update({"$inc": {"reward_points": req.points}})

    # We could optionally log this to ActivityLog
    from app.models.activity_log import ActivityLog
    await ActivityLog(
        user_id=receiver.id,
        action="peer_recognition_received",
        details=f"Received {req.points} point(s) from {current_user.name} for: {req.reason}"
    ).insert()

    return {"message": "Recognition sent successfully", "points_given": req.points}

@router.get("/received", response_model=List[dict])
async def get_received_recognitions(current_user: User = Depends(get_current_user)):
    """Get recognitions received by the current user."""
    recognitions = await PeerRecognition.find(PeerRecognition.receiver_id == current_user.id).sort("-created_at").to_list()
    # Serialize ObjectId
    res = []
    for r in recognitions:
        created_dt = getattr(r, "created_at", None)
        created_str = created_dt.isoformat() + "Z" if hasattr(created_dt, "isoformat") else str(created_dt) if created_dt else None
        
        res.append({
            "id": str(r.id),
            "sender_id": str(r.sender_id) if hasattr(r, "sender_id") and r.sender_id else None,
            "sender_name": getattr(r, "sender_name", "Unknown"),
            "receiver_id": str(r.receiver_id) if hasattr(r, "receiver_id") and r.receiver_id else None,
            "receiver_name": getattr(r, "receiver_name", "Unknown"),
            "company_id": str(r.company_id) if getattr(r, "company_id", None) else None,
            "points": float(r.points) if getattr(r, "points", None) is not None else 0.0,
            "reason": r.reason if getattr(r, "reason", None) is not None else "",
            "created_at": created_str
        })
    return res

@router.get("/sent", response_model=List[dict])
async def get_sent_recognitions(current_user: User = Depends(get_current_user)):
    """Get recognitions sent by the current user."""
    recognitions = await PeerRecognition.find(PeerRecognition.sender_id == current_user.id).sort("-created_at").to_list()
    # Serialize ObjectId
    res = []
    for r in recognitions:
        created_dt = getattr(r, "created_at", None)
        created_str = created_dt.isoformat() + "Z" if hasattr(created_dt, "isoformat") else str(created_dt) if created_dt else None
        
        res.append({
            "id": str(r.id),
            "sender_id": str(r.sender_id) if hasattr(r, "sender_id") and r.sender_id else None,
            "sender_name": getattr(r, "sender_name", "Unknown"),
            "receiver_id": str(r.receiver_id) if hasattr(r, "receiver_id") and r.receiver_id else None,
            "receiver_name": getattr(r, "receiver_name", "Unknown"),
            "company_id": str(r.company_id) if getattr(r, "company_id", None) else None,
            "points": float(r.points) if getattr(r, "points", None) is not None else 0.0,
            "reason": r.reason if getattr(r, "reason", None) is not None else "",
            "created_at": created_str
        })
    return res


@router.get("/leaderboard", response_model=List[dict])
async def get_recognition_leaderboard(current_user: User = Depends(get_current_user)):
    """Get leaderboard of employees filtered by company privacy rules."""
    from app.services.reward_service import get_leaderboard
    return await get_leaderboard(limit=10, current_user=current_user)
