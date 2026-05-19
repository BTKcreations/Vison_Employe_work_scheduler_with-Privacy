"""
Employee management routes - hierarchical CRUD operations.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.user import CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeResponse
from app.services import user_service, dashboard_service
from app.auth.dependencies import require_admin, require_management
from app.models.user import User, UserRole
from typing import List
from beanie import PydanticObjectId
from beanie.operators import In

router = APIRouter(prefix="/admin/employees", tags=["Employee Management"])


async def check_hierarchy(current_user: User, target_user: User) -> bool:
    """Helper to check if target_user reports to current_user."""
    if current_user.id == target_user.id:
        return True
    if current_user.role == UserRole.SUPER_ADMIN:
        return True
    if current_user.role == UserRole.ADMIN:
        # Admin can manage users in their company/companies
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if target_user.company_id in co_ids:
            return True
        if target_user.company_id is None:
            return True
        return False
    if current_user.role == UserRole.MANAGER:
        # Direct subordinate (reports to this manager)
        if target_user.parent_id == current_user.id:
            return True
        # Indirect subordinate (reports to an assistant manager under this manager)
        if target_user.parent_id:
            parent = await User.get(target_user.parent_id)
            if parent and parent.role == UserRole.ASSISTANT_MANAGER and parent.parent_id == current_user.id:
                return True
    if current_user.role == UserRole.ASSISTANT_MANAGER:
        # Only direct subordinates
        if target_user.parent_id == current_user.id:
            return True
    return False


@router.get("", response_model=List[EmployeeResponse])
async def list_employees(current_user: User = Depends(require_management)):
    """Get all employees visible in the user's hierarchy."""
    employees = await user_service.get_all_employees(current_user)
    
    # Resolve parent names in bulk
    parent_ids = {emp.parent_id for emp in employees if getattr(emp, "parent_id", None)}
    parent_names = {}
    if parent_ids:
        parents = await User.find(In(User.id, list(parent_ids))).to_list()
        parent_names = {p.id: p.name for p in parents}

    # Resolve company names in bulk
    company_ids = {emp.company_id for emp in employees if getattr(emp, "company_id", None)}
    company_names = {}
    if company_ids:
        from app.models.company import Company
        companies = await Company.find(In(Company.id, list(company_ids))).to_list()
        company_names = {c.id: c.name for c in companies}
        
    return [
        EmployeeResponse.from_user(
            emp, 
            parent_names.get(emp.parent_id),
            company_names.get(emp.company_id)
        ) 
        for emp in employees
    ]


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: str, current_user: User = Depends(require_management)):
    """Get a specific employee (filtered by hierarchy visibility)."""
    employee = await user_service.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    
    # Enforce hierarchy bounds
    if not await check_hierarchy(current_user, employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: employee is outside of your management tree",
        )
        
    parent_name = None
    if employee.parent_id:
        parent = await User.get(employee.parent_id)
        if parent:
            parent_name = parent.name

    company_name = None
    if employee.company_id:
        from app.models.company import Company
        company = await Company.get(employee.company_id)
        if company:
            company_name = company.name
            
    return EmployeeResponse.from_user(employee, parent_name, company_name)


from app.auth.dependencies import get_current_user

@router.get("/{employee_id}/stats")
async def get_employee_stats(employee_id: str, current_user: User = Depends(get_current_user)):
    """Get stats for a specific employee (filtered by hierarchy visibility)."""
    employee = await user_service.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    
    if current_user.id == employee.id:
        return await dashboard_service.get_employee_dashboard(employee_id)
        
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
        
    if not await check_hierarchy(current_user, employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: employee is outside of your management tree",
        )
        
    return await dashboard_service.get_employee_dashboard(employee_id)


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    request: CreateEmployeeRequest,
    current_user: User = Depends(require_management),
):
    """Create a new user (with hierarchy validation)."""
    if current_user.role == UserRole.ASSISTANT_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant Managers are not allowed to create users",
        )
        
    target_role = request.role
    parent_id = request.parent_id

    if target_role == "super_admin" and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can create Super Admins",
        )

    company_id = request.company_id
    if current_user.role == UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == UserRole.ADMIN:
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if company_id:
            if PydanticObjectId(company_id) not in co_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: company is outside of your management scope",
                )
        else:
            company_id = str(current_user.company_id) if current_user.company_id else (str(companies[0].id) if companies else None)
    else:
        company_id = str(current_user.company_id)

    # If manager is creating, restrict roles and force parent bindings
    if current_user.role == UserRole.MANAGER:
        if target_role not in ["assistant_manager", "employee"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only create Assistant Managers and Employees",
            )
        
        if target_role == "assistant_manager":
            # Assistant manager created by a manager must report directly to that manager
            parent_id = str(current_user.id)
        elif target_role == "employee":
            # Employees created by a manager must report either to the manager or to an ASM reporting to the manager
            if parent_id:
                pid = PydanticObjectId(parent_id)
                # Allow the manager themselves as a direct supervisor
                if pid != current_user.id:
                    p_user = await User.get(pid)
                    if not p_user or p_user.role != UserRole.ASSISTANT_MANAGER or p_user.parent_id != current_user.id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid parent supervisor: employee must report to you or one of your assistant managers",
                        )
            else:
                # Default parent to the manager
                parent_id = str(current_user.id)
                
    # If admin is creating, validate parent structure if specified
    elif current_user.role == UserRole.ADMIN:
        if parent_id:
            p_user = await User.get(PydanticObjectId(parent_id))
            if target_role == "assistant_manager":
                if not p_user or p_user.role != UserRole.MANAGER:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid parent supervisor: Assistant Managers must report to a Manager",
                    )
            elif target_role == "employee":
                if not p_user or p_user.role not in [UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid parent supervisor: Employees must report to a Manager or Assistant Manager",
                    )

    try:
        employee = await user_service.create_employee(
            name=request.name,
            email=request.email,
            password=request.password,
            mobile=request.mobile,
            alternate_mobile=request.alternate_mobile,
            role=target_role,
            base_salary=request.base_salary if request.base_salary is not None else 30000.0,
            parent_id=parent_id,
            company_id=company_id,
        )
        
        parent_name = None
        if employee.parent_id:
            parent = await User.get(employee.parent_id)
            if parent:
                parent_name = parent.name

        company_name = None
        if employee.company_id:
            from app.models.company import Company
            comp = await Company.get(employee.company_id)
            if comp:
                company_name = comp.name
                
        return EmployeeResponse.from_user(employee, parent_name, company_name)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    request: UpdateEmployeeRequest,
    current_user: User = Depends(require_management),
):
    """Update employee details (with hierarchy validation)."""
    employee = await user_service.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
        
    # Enforce hierarchy bounds
    if not await check_hierarchy(current_user, employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: employee is outside of your management tree",
        )

    # Prevent role updates that violate hierarchy
    target_role = request.role or employee.role.value
    
    if target_role in ["admin", "manager"]:
        parent_id = None
    elif request.parent_id == "":
        parent_id = None
    elif request.parent_id is not None:
        parent_id = request.parent_id
    else:
        parent_id = str(employee.parent_id) if employee.parent_id else None

    company_id = request.company_id
    if company_id is not None:
        if current_user.role == UserRole.SUPER_ADMIN:
            pass
        elif current_user.role == UserRole.ADMIN:
            from app.models.company import Company
            companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
            co_ids = {c.id for c in companies}
            if company_id:
                if PydanticObjectId(company_id) not in co_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: company is outside of your management scope",
                    )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admins and Super Admins can update employee company assignments",
            )
    
    if current_user.role == UserRole.ASSISTANT_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant Managers are not allowed to update user profiles",
        )
        
    if current_user.role == UserRole.MANAGER:
        if target_role not in ["assistant_manager", "employee"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only configure Assistant Managers and Employees",
            )
        
        if target_role == "assistant_manager":
            parent_id = str(current_user.id)
        elif target_role == "employee" and request.parent_id:
            pid = PydanticObjectId(parent_id)
            # Allow the manager themselves as a direct supervisor
            if pid != current_user.id:
                p_user = await User.get(pid)
                if not p_user or p_user.role != UserRole.ASSISTANT_MANAGER or p_user.parent_id != current_user.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid parent supervisor: employee must report to you or one of your assistant managers",
                    )
                
    elif current_user.role == UserRole.ADMIN:
        if parent_id:
            p_user = await User.get(PydanticObjectId(parent_id))
            if target_role == "assistant_manager":
                if not p_user or p_user.role != UserRole.MANAGER:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid parent supervisor: Assistant Managers must report to a Manager",
                    )
            elif target_role == "employee":
                if not p_user or p_user.role not in [UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid parent supervisor: Employees must report to a Manager or Assistant Manager",
                    )

    try:
        updated = await user_service.update_employee(
            employee_id,
            name=request.name,
            email=request.email,
            is_active=request.is_active,
            mobile=request.mobile,
            alternate_mobile=request.alternate_mobile,
            reward_points=request.reward_points,
            base_salary=request.base_salary,
            role=request.role,
            password=request.password,
            parent_id=parent_id,
            company_id=company_id,
        )
        
        parent_name = None
        if updated.parent_id:
            parent = await User.get(updated.parent_id)
            if parent:
                parent_name = parent.name

        company_name = None
        if updated.company_id:
            from app.models.company import Company
            comp = await Company.get(updated.company_id)
            if comp:
                company_name = comp.name
                
        return EmployeeResponse.from_user(updated, parent_name, company_name)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    current_user: User = Depends(require_management),
):
    """Deactivate an employee (with hierarchy validation)."""
    if current_user.role == UserRole.ASSISTANT_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant Managers are not allowed to deactivate users",
        )
        
    employee = await user_service.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
        
    if not await check_hierarchy(current_user, employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: employee is outside of your management tree",
        )
        
    deactivated = await user_service.deactivate_employee(employee_id)
    return {"message": f"Employee {deactivated.name} deactivated"}
