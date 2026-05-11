"""
Employee management routes - admin only CRUD operations.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.user import CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeResponse
from app.services import user_service, dashboard_service
from app.auth.dependencies import require_admin
from app.models.user import User
from typing import List

router = APIRouter(prefix="/admin/employees", tags=["Employee Management"])


@router.get("", response_model=List[EmployeeResponse])
async def list_employees(admin: User = Depends(require_admin)):
    """Get all employees (admin only)."""
    employees = await user_service.get_all_employees()
    return [EmployeeResponse.from_user(emp) for emp in employees]


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: str, admin: User = Depends(require_admin)):
    """Get a specific employee (admin only)."""
    employee = await user_service.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return EmployeeResponse.from_user(employee)


@router.get("/{employee_id}/stats")
async def get_employee_stats(employee_id: str, admin: User = Depends(require_admin)):
    """Get stats for a specific employee (admin only)."""
    return await dashboard_service.get_employee_dashboard(employee_id)


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    request: CreateEmployeeRequest,
    admin: User = Depends(require_admin),
):
    """Create a new employee (admin only)."""
    try:
        employee = await user_service.create_employee(
            name=request.name,
            email=request.email,
            password=request.password,
            mobile=request.mobile,
            alternate_mobile=request.alternate_mobile,
            role=request.role,
        )
        return EmployeeResponse.from_user(employee)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    request: UpdateEmployeeRequest,
    admin: User = Depends(require_admin),
):
    try:
        employee = await user_service.update_employee(
            employee_id,
            name=request.name,
            email=request.email,
            is_active=request.is_active,
            mobile=request.mobile,
            alternate_mobile=request.alternate_mobile,
            reward_points=request.reward_points,
            role=request.role,
            password=request.password,
        )
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )
        return EmployeeResponse.from_user(employee)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    admin: User = Depends(require_admin),
):
    """Deactivate an employee (admin only)."""
    employee = await user_service.deactivate_employee(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return {"message": f"Employee {employee.name} deactivated"}
