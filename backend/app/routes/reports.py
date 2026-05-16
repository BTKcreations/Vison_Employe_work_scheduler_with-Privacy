"""
Report routes - CSV and Excel export endpoints.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.auth.dependencies import require_admin, get_current_user
from app.services import report_service
from app.models.user import User
from typing import Optional
from io import BytesIO

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/tasks/csv")
async def export_tasks_csv(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone: Optional[str] = None,
    admin: User = Depends(require_admin),
):
    """Export task report as CSV (admin only)."""
    csv_data = await report_service.generate_tasks_csv(
        status=status,
        employee_id=employee_id,
        priority=priority,
        start_date=start_date,
        end_date=end_date,
        tz_name=timezone,
    )
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks_report.csv"},
    )


@router.get("/tasks/excel")
async def export_tasks_excel(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone: Optional[str] = None,
    admin: User = Depends(require_admin),
):
    """Export task report as Excel (admin only)."""
    excel_data = await report_service.generate_tasks_excel(
        status=status,
        employee_id=employee_id,
        priority=priority,
        start_date=start_date,
        end_date=end_date,
        tz_name=timezone,
    )
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=tasks_report.xlsx"},
    )


@router.get("/employees/excel")
async def export_employees_excel(
    admin: User = Depends(require_admin),
):
    """Export employee report as Excel (admin only)."""
    excel_data = await report_service.generate_employees_excel()
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=employees_report.xlsx"},
    )


@router.get("/me/tasks/csv")
async def export_my_tasks_csv(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Export current employee's task report as CSV."""
    csv_data = await report_service.generate_tasks_csv(
        status=status,
        employee_id=str(current_user.id),
        priority=priority,
        start_date=start_date,
        end_date=end_date,
        tz_name=timezone,
    )
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=my_tasks_report.csv"},
    )


@router.get("/me/tasks/excel")
async def export_my_tasks_excel(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Export current employee's task report as Excel."""
    excel_data = await report_service.generate_tasks_excel(
        status=status,
        employee_id=str(current_user.id),
        priority=priority,
        start_date=start_date,
        end_date=end_date,
        tz_name=timezone,
    )
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=my_tasks_report.xlsx"},
    )


@router.get("/me/attendance/excel")
async def export_my_attendance_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Export current employee's attendance report as Excel."""
    excel_data = await report_service.generate_attendance_excel(
        user_id=str(current_user.id),
        start_date=start_date,
        end_date=end_date,
        tz_name=timezone,
    )
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=my_attendance_report.xlsx"},
    )


@router.get("/admin/attendance/excel")
async def export_attendance_excel_admin(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone: Optional[str] = None,
    admin: User = Depends(require_admin),
):
    """Export attendance report for all or specific employee as Excel (admin only)."""
    excel_data = await report_service.generate_attendance_excel(
        user_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        tz_name=timezone,
    )
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=attendance_report.xlsx"},
    )
