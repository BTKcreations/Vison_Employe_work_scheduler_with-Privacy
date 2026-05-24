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
    from app.models.role import BaseArchetype

    if current_user.id == target_user.id:
        return True

    arch = current_user.role_archetype or current_user.role

    if arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
        return True

    # Restrict tenant users from managing super_admins or support
    target_arch = target_user.role_archetype or target_user.role
    if target_arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
        return False
    if target_arch in [BaseArchetype.SUPPORT, UserRole.SUPPORT]:
        return arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN, BaseArchetype.SUPPORT, UserRole.SUPPORT]

    if arch in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.HR, UserRole.HR, BaseArchetype.IT, UserRole.IT]:
        # Admin / HR can manage users in their company/companies
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if target_user.company_id in co_ids:
            return True
        if target_user.company_id is None:
            return True
        return False
    if arch in [BaseArchetype.MANAGER, UserRole.MANAGER]:
        # Direct subordinate (reports to this manager)
        if target_user.parent_id == current_user.id:
            return True
        # Indirect subordinate (reports to an assistant manager under this manager)
        if target_user.parent_id:
            parent = await User.get(target_user.parent_id)
            if parent:
                parent_arch = parent.role_archetype or parent.role
                if parent_arch in [BaseArchetype.ASSISTANT_MANAGER, UserRole.ASSISTANT_MANAGER] and parent.parent_id == current_user.id:
                    return True
    if arch in [BaseArchetype.ASSISTANT_MANAGER, UserRole.ASSISTANT_MANAGER]:
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


from app.auth.dependencies import get_current_user

@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific employee (filtered by hierarchy visibility)."""
    employee = await user_service.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    
    # Allow self viewing
    if str(current_user.id) != str(employee.id):
        # Otherwise, check management and hierarchy
        from app.models.role import BaseArchetype
        arch = current_user.role_archetype or current_user.role
        allowed_management = [
            BaseArchetype.ADMIN, BaseArchetype.SUPER_ADMIN, 
            BaseArchetype.MANAGER, BaseArchetype.ASSISTANT_MANAGER,
            BaseArchetype.HR, BaseArchetype.IT, BaseArchetype.FINANCE, BaseArchetype.AUDITOR,
            UserRole.ADMIN, UserRole.SUPER_ADMIN,
            UserRole.MANAGER, UserRole.ASSISTANT_MANAGER,
            UserRole.HR, UserRole.IT, UserRole.FINANCE, UserRole.AUDITOR
        ]
        if arch not in allowed_management:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you must be a manager or admin to view other profiles",
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
        
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
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
    from app.models.role import BaseArchetype, CompanyRole

    arch = current_user.role_archetype or current_user.role
    if arch in [BaseArchetype.ASSISTANT_MANAGER, UserRole.ASSISTANT_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant Managers are not allowed to create users",
        )

    target_role = request.role
    parent_id = request.parent_id

    # Resolve target archetype for validations
    target_arch = None
    if current_user.company_id:
        db_role = await CompanyRole.find_one(
            CompanyRole.company_id == current_user.company_id,
            CompanyRole.display_name == target_role
        )
        if not db_role:
            try:
                arch_enum = BaseArchetype(target_role)
                db_role = await CompanyRole.find_one(
                    CompanyRole.company_id == None,
                    CompanyRole.base_archetype == arch_enum
                )
            except ValueError:
                pass
        if db_role:
            target_arch = db_role.base_archetype

    if not target_arch:
        try:
            target_arch = BaseArchetype(target_role)
        except ValueError:
            target_arch = BaseArchetype.EMPLOYEE

    # 1. SaaS Provider level restriction: Tenant users cannot create Super Admin or Support roles
    if target_arch in [BaseArchetype.SUPER_ADMIN, BaseArchetype.SUPPORT]:
        if arch not in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN, BaseArchetype.SUPPORT, UserRole.SUPPORT]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant users cannot create SaaS Provider level roles (Super Admin, Support)",
            )

    # 2. Workspace Admin role checks: Only Super Admin and Admins can create Admin roles
    if target_arch == BaseArchetype.ADMIN:
        if arch not in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN, BaseArchetype.ADMIN, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admins and Super Admins can create Admin roles",
            )

    # 3. Manager/HR validation checks for target role creation
    if arch in [BaseArchetype.MANAGER, UserRole.MANAGER]:
        if target_arch not in [BaseArchetype.ASSISTANT_MANAGER, BaseArchetype.EMPLOYEE, BaseArchetype.CONTRACTOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only create Assistant Managers, Employees, and Contractors",
            )

    company_id = request.company_id
    if arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
        pass
    elif arch in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.HR, UserRole.HR]:
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

    # If manager is creating, force parent bindings
    if arch in [BaseArchetype.MANAGER, UserRole.MANAGER]:
        if target_arch == BaseArchetype.ASSISTANT_MANAGER:
            # Assistant manager created by a manager must report directly to that manager
            parent_id = str(current_user.id)
        elif target_arch in [BaseArchetype.EMPLOYEE, BaseArchetype.CONTRACTOR]:
            # Employees/Contractors created by a manager must report either to the manager or to an ASM reporting to the manager
            if parent_id:
                pid = PydanticObjectId(parent_id)
                if pid != current_user.id:
                    p_user = await User.get(pid)
                    if p_user:
                        p_user_arch = p_user.role_archetype or p_user.role
                        if p_user_arch not in [BaseArchetype.ASSISTANT_MANAGER, UserRole.ASSISTANT_MANAGER] or p_user.parent_id != current_user.id:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid parent supervisor: employee must report to you or one of your assistant managers",
                            )
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Supervisor not found",
                        )
            else:
                parent_id = str(current_user.id)

    # Generalized parent checks (who reports to who & company bounds)
    if parent_id:
        p_user = await User.get(PydanticObjectId(parent_id))
        if not p_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supervisor not found",
            )
        
        # Verify parent belongs to same company
        if company_id and p_user.company_id and str(p_user.company_id) != str(company_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supervisor must belong to the same company/department",
            )

        p_user_arch = p_user.role_archetype or p_user.role
        
        # Hierarchy reporting validation rules
        if target_arch == BaseArchetype.ASSISTANT_MANAGER:
            if p_user_arch not in [BaseArchetype.MANAGER, UserRole.MANAGER]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Assistant Managers must report to a Manager",
                )
        elif target_arch in [BaseArchetype.EMPLOYEE, BaseArchetype.CONTRACTOR]:
            if p_user_arch not in [BaseArchetype.MANAGER, BaseArchetype.ASSISTANT_MANAGER, UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Employees/Contractors must report to a Manager or Assistant Manager",
                )
        elif target_arch in [BaseArchetype.HR, BaseArchetype.FINANCE, BaseArchetype.IT, BaseArchetype.AUDITOR]:
            if p_user_arch not in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.MANAGER, UserRole.MANAGER, BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid parent supervisor: {target_arch.value.replace('_', ' ').title()} must report to an Admin or Manager",
                )
        elif target_arch == BaseArchetype.MANAGER:
            if p_user_arch not in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Managers must report to an Admin",
                )
        elif target_arch == BaseArchetype.ADMIN:
            if p_user_arch not in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Admins must report to another Admin or Super Admin",
                )

    # SaaS Plan Verification: Check max employees limit
    if company_id:
        from app.models.company import Company
        try:
            comp_obj = await Company.get(PydanticObjectId(company_id))
            if comp_obj:
                max_emp = getattr(comp_obj, "subscription_max_employees", 10)
                if max_emp > 0:
                    active_count = await User.find(User.company_id == PydanticObjectId(company_id), User.is_active == True).count()
                    if active_count >= max_emp:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Subscription Limit Reached: Your plan only allows up to {max_emp} active employees."
                        )
        except Exception:
            pass

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

    company_id = request.company_id
    # Prevent role updates that violate hierarchy
    target_role = request.role or employee.role.value
    
    # Resolve target archetype for validations
    from app.models.role import BaseArchetype, CompanyRole
    
    target_arch = None
    res_company_id = company_id or (str(employee.company_id) if employee.company_id else None)
    
    if res_company_id:
        try:
            r_co_id = PydanticObjectId(res_company_id)
        except Exception:
            r_co_id = None
            
        if r_co_id:
            db_role = await CompanyRole.find_one(
                CompanyRole.company_id == r_co_id,
                CompanyRole.display_name == target_role
            )
            if not db_role:
                try:
                    arch_enum = BaseArchetype(target_role)
                    db_role = await CompanyRole.find_one(
                        CompanyRole.company_id == None,
                        CompanyRole.base_archetype == arch_enum
                    )
                except ValueError:
                    pass
            if db_role:
                target_arch = db_role.base_archetype

    if not target_arch:
        try:
            target_arch = BaseArchetype(target_role)
        except ValueError:
            target_arch = BaseArchetype.EMPLOYEE

    if target_arch in [BaseArchetype.ADMIN, BaseArchetype.SUPER_ADMIN]:
        parent_id = None
    elif request.parent_id == "":
        parent_id = None
    elif request.parent_id is not None:
        parent_id = request.parent_id
    else:
        parent_id = str(employee.parent_id) if employee.parent_id else None

    current_arch = current_user.role_archetype or current_user.role

    # 1. SaaS Provider level restriction: Tenant users cannot assign Super Admin or Support roles
    if target_arch in [BaseArchetype.SUPER_ADMIN, BaseArchetype.SUPPORT]:
        if current_arch not in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN, BaseArchetype.SUPPORT, UserRole.SUPPORT]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenants cannot assign SaaS Provider level roles (Super Admin, Support)",
            )

    # 2. Workspace Admin role checks: Only Super Admin and Admins can assign Admin roles
    if target_arch == BaseArchetype.ADMIN:
        if current_arch not in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN, BaseArchetype.ADMIN, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admins and Super Admins can assign Admin roles",
            )

    if company_id is not None:
        if current_arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
            pass
        elif current_arch in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.HR, UserRole.HR]:
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
    
    if current_arch in [BaseArchetype.ASSISTANT_MANAGER, UserRole.ASSISTANT_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant Managers are not allowed to update user profiles",
        )
        
    if current_arch in [BaseArchetype.MANAGER, UserRole.MANAGER]:
        if target_arch not in [BaseArchetype.ASSISTANT_MANAGER, BaseArchetype.EMPLOYEE, BaseArchetype.CONTRACTOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only configure Assistant Managers, Employees, and Contractors",
            )
        
        if target_arch == BaseArchetype.ASSISTANT_MANAGER:
            parent_id = str(current_user.id)
        elif target_arch in [BaseArchetype.EMPLOYEE, BaseArchetype.CONTRACTOR] and parent_id:
            pid = PydanticObjectId(parent_id)
            # Allow the manager themselves as a direct supervisor
            if pid != current_user.id:
                p_user = await User.get(pid)
                p_user_arch = (p_user.role_archetype or p_user.role) if p_user else None
                if not p_user or p_user_arch not in [BaseArchetype.ASSISTANT_MANAGER, UserRole.ASSISTANT_MANAGER] or p_user.parent_id != current_user.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid parent supervisor: employee must report to you or one of your assistant managers",
                    )

    # Generalized parent checks (who reports to who & company bounds)
    if parent_id:
        if parent_id == employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user cannot report to themselves",
            )

        p_user = await User.get(PydanticObjectId(parent_id))
        if not p_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supervisor not found",
            )
        
        # Verify parent belongs to same company
        resolved_co_id = company_id or (str(employee.company_id) if employee.company_id else None)
        if resolved_co_id and p_user.company_id and str(p_user.company_id) != str(resolved_co_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supervisor must belong to the same company/department",
            )

        p_user_arch = p_user.role_archetype or p_user.role
        
        # Hierarchy reporting validation rules
        if target_arch == BaseArchetype.ASSISTANT_MANAGER:
            if p_user_arch not in [BaseArchetype.MANAGER, UserRole.MANAGER]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Assistant Managers must report to a Manager",
                )
        elif target_arch in [BaseArchetype.EMPLOYEE, BaseArchetype.CONTRACTOR]:
            if p_user_arch not in [BaseArchetype.MANAGER, BaseArchetype.ASSISTANT_MANAGER, UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Employees/Contractors must report to a Manager or Assistant Manager",
                )
        elif target_arch in [BaseArchetype.HR, BaseArchetype.FINANCE, BaseArchetype.IT, BaseArchetype.AUDITOR]:
            if p_user_arch not in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.MANAGER, UserRole.MANAGER, BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid parent supervisor: {target_arch.value.replace('_', ' ').title()} must report to an Admin or Manager",
                )
        elif target_arch == BaseArchetype.MANAGER:
            if p_user_arch not in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Managers must report to an Admin",
                )
        elif target_arch == BaseArchetype.ADMIN:
            if p_user_arch not in [BaseArchetype.ADMIN, UserRole.ADMIN, BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid parent supervisor: Admins must report to another Admin or Super Admin",
                )

    try:
        update_kwargs = {
            "name": request.name,
            "email": request.email,
            "is_active": request.is_active,
            "mobile": request.mobile,
            "alternate_mobile": request.alternate_mobile,
            "reward_points": request.reward_points,
            "base_salary": request.base_salary,
            "role": request.role,
            "password": request.password,
            "parent_id": parent_id,
        }
        if "company_id" in request.model_fields_set:
            update_kwargs["company_id"] = company_id

        updated = await user_service.update_employee(
            employee_id,
            **update_kwargs
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
