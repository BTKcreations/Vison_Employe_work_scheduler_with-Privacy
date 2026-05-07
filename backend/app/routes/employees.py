"""
Employee management routes - admin only CRUD operations.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.user import CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeResponse
from app.services import user_service
from app.auth.dependencies import require_admin
from app.models.user import User
from typing import List

router = APIRouter(prefix="/admin/employees", tags=["Employee Management"])


@router.get("", response_model=List[EmployeeResponse])
async def list_employees(admin: User = Depends(require_admin)):
    """Get all employees (admin only)."""
    employees = await user_service.get_all_employees()
    return [EmployeeResponse.from_user(emp) for emp in employees]


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
    """Update an employee (admin only)."""
    employee = await user_service.update_employee(
        employee_id,
        name=request.name,
        email=request.email,
        is_active=request.is_active,
    )
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return EmployeeResponse.from_user(employee)


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
