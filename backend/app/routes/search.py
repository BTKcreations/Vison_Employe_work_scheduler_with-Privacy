from fastapi import APIRouter, Depends, Query
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.search_service import global_search

router = APIRouter(tags=["Search"])

@router.get("/search")
async def search(
    q: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_user)
):
    """
    Global search endpoint.
    """
    return await global_search(q)
