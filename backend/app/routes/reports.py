"""
Report routes - CSV and Excel export endpoints.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.auth.dependencies import require_admin
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
    admin: User = Depends(require_admin),
):
    """Export task report as CSV (admin only)."""
    csv_data = await report_service.generate_tasks_csv(
        status=status,
        employee_id=employee_id,
        priority=priority,
        start_date=start_date,
        end_date=end_date,
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
    admin: User = Depends(require_admin),
):
    """Export task report as Excel (admin only)."""
    excel_data = await report_service.generate_tasks_excel(
        status=status,
        employee_id=employee_id,
        priority=priority,
        start_date=start_date,
        end_date=end_date,
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
