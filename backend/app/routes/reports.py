"""
Report routes - CSV and Excel export endpoints.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.auth.dependencies import require_admin, require_management, get_current_user
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
    admin: User = Depends(require_management),
):
    """Export task report as CSV (filtered by hierarchy)."""
    csv_data = await report_service.generate_tasks_csv(
        current_user=admin,
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
    admin: User = Depends(require_management),
):
    """Export task report as Excel (filtered by hierarchy)."""
    excel_data = await report_service.generate_tasks_excel(
        current_user=admin,
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
    admin: User = Depends(require_management),
):
    """Export employee report as Excel (filtered by hierarchy)."""
    excel_data = await report_service.generate_employees_excel(current_user=admin)
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
        current_user=current_user,
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
        current_user=current_user,
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
        current_user=current_user,
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
    admin: User = Depends(require_management),
):
    """Export attendance report for all or specific employee as Excel (filtered by hierarchy)."""
    excel_data = await report_service.generate_attendance_excel(
        current_user=admin,
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


@router.get("/payroll")
async def get_payroll_report(
    year: int = Query(default=None),
    month: int = Query(default=None),
    admin: User = Depends(require_management),
):
    """Get monthly payroll data for all employees (filtered by hierarchy)."""
    current_time = datetime.utcnow()
    yr = year if year is not None else current_time.year
    mon = month if month is not None else current_time.month
    return await report_service.calculate_payroll_data(admin, yr, mon)


@router.get("/payroll/excel")
async def export_payroll_excel(
    year: int = Query(default=None),
    month: int = Query(default=None),
    admin: User = Depends(require_management),
):
    """Export monthly payroll report as a beautifully styled Excel spreadsheet (filtered by hierarchy)."""
    current_time = datetime.utcnow()
    yr = year if year is not None else current_time.year
    mon = month if month is not None else current_time.month
    excel_data = await report_service.generate_payroll_excel(admin, yr, mon)
    filename = f"payroll_report_{yr}_{mon:02d}.xlsx"
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/me/payroll")
async def get_my_payroll_report(
    year: int = Query(default=None),
    month: int = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """Get monthly payroll data for the authenticated employee."""
    current_time = datetime.utcnow()
    yr = year if year is not None else current_time.year
    mon = month if month is not None else current_time.month
    return await report_service.calculate_payroll_data(
        current_user=current_user,
        year=yr,
        month=mon,
        employee_id=str(current_user.id)
    )


@router.get("/me/payroll/excel")
async def export_my_payroll_excel(
    year: int = Query(default=None),
    month: int = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """Export monthly payroll report for the authenticated employee as a styled Excel spreadsheet."""
    current_time = datetime.utcnow()
    yr = year if year is not None else current_time.year
    mon = month if month is not None else current_time.month
    excel_data = await report_service.generate_payroll_excel(
        current_user=current_user,
        year=yr,
        month=mon,
        employee_id=str(current_user.id)
    )
    filename = f"my_payroll_report_{yr}_{mon:02d}.xlsx"
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

