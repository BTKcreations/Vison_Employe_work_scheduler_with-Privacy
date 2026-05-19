"""
Dashboard routes - analytics data for admin and employee dashboards.
"""
from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user, require_admin, require_management
from app.services import dashboard_service
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/admin")
async def admin_dashboard(admin: User = Depends(require_management)):
    """Get admin/management dashboard analytics data (filtered by hierarchy)."""
    return await dashboard_service.get_admin_dashboard(admin)


@router.get("/employee")
async def employee_dashboard(current_user: User = Depends(get_current_user)):
    """Get employee personal dashboard data."""
    return await dashboard_service.get_employee_dashboard(str(current_user.id))
