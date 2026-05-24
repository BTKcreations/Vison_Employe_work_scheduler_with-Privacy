"""
User/Employee service - business logic for user operations.
"""
from app.models.user import User, UserRole
from app.auth.password import hash_password
from app.models.activity_log import ActivityLog
from beanie import PydanticObjectId
from datetime import datetime
from typing import Optional, List


async def create_employee(
    name: str,
    email: str,
    password: str,
    mobile: str = None,
    alternate_mobile: str = None,
    role: str = "employee",
    base_salary: float = 30000.0,
    parent_id: str = None,
    company_id: str = None,
) -> User:
    """Create a new employee user."""
    existing = await User.find_one(User.email == email)
    if existing:
        raise ValueError("Email already registered")

    resolved_company_id = PydanticObjectId(company_id) if company_id else None
    resolved_parent_id = PydanticObjectId(parent_id) if parent_id else None

    # If company_id is not explicitly provided, try to inherit from parent
    if not resolved_company_id and resolved_parent_id:
        parent = await User.get(resolved_parent_id)
        if parent:
            resolved_company_id = parent.company_id

    # Resolve role display name, archetype and ID
    from app.models.role import CompanyRole, BaseArchetype
    
    role_id = None
    role_display_name = None
    role_archetype = None
    
    # Try to find a custom role or standard template for this company
    db_role = None
    if resolved_company_id:
        # Check if there's a custom role matching the display name/role string
        db_role = await CompanyRole.find_one(
            CompanyRole.company_id == resolved_company_id,
            CompanyRole.display_name == role
        )
    if not db_role:
        # Fallback to system default template
        try:
            arch_val = BaseArchetype(role)
            db_role = await CompanyRole.find_one(
                CompanyRole.company_id == None,
                CompanyRole.base_archetype == arch_val
            )
        except ValueError:
            pass

    if db_role:
        role_id = db_role.id
        role_display_name = db_role.display_name
        role_archetype = db_role.base_archetype
    else:
        try:
            role_archetype = BaseArchetype(role)
            role_display_name = role.replace("_", " ").title()
        except ValueError:
            role_archetype = BaseArchetype.EMPLOYEE
            role_display_name = "Employee"

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=UserRole(role_archetype.value),
        role_id=role_id,
        role_display_name=role_display_name,
        role_archetype=role_archetype,
        mobile=mobile,
        alternate_mobile=alternate_mobile,
        base_salary=base_salary,
        parent_id=resolved_parent_id,
        company_id=resolved_company_id,
    )
    await user.insert()

    await ActivityLog(
        user_id=user.id,
        action="employee_created",
        details=f"Employee {name} created",
    ).insert()

    return user


async def get_all_employees(current_user: Optional[User] = None) -> List[User]:
    """Get employee users, filtered by hierarchy if current_user is provided."""
    from beanie.operators import In
    from app.models.role import BaseArchetype

    if not current_user:
        return await User.find(User.role != UserRole.SUPER_ADMIN).sort("-created_at").to_list()

    arch = current_user.role_archetype or current_user.role

    if arch in [BaseArchetype.SUPER_ADMIN, UserRole.SUPER_ADMIN]:
        # Super Admin sees everyone in the system except other super admins
        return await User.find(User.role != UserRole.SUPER_ADMIN).sort("-created_at").to_list()

    if arch in [
        BaseArchetype.ADMIN, UserRole.ADMIN, 
        BaseArchetype.HR, UserRole.HR,
        BaseArchetype.IT, UserRole.IT,
        BaseArchetype.FINANCE, UserRole.FINANCE,
        BaseArchetype.AUDITOR, UserRole.AUDITOR
    ]:
        # Admin / HR sees all employees in their managed companies (company_id match)
        # Since Admin can manage multiple companies, we search companies owned by admin
        # and find users in those companies, or users matching current_user.company_id.
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = [c.id for c in companies]
        return await User.find(
            User.role != UserRole.SUPER_ADMIN,
            User.role != UserRole.ADMIN,
            In(User.company_id, co_ids)
        ).sort("-created_at").to_list()

    if arch in [BaseArchetype.MANAGER, UserRole.MANAGER]:
        # Find all assistant managers reporting to this manager
        asms = await User.find(User.role == UserRole.ASSISTANT_MANAGER, User.parent_id == current_user.id).to_list()
        asm_ids = [asm.id for asm in asms]
        return await User.find(
            {
                "company_id": current_user.company_id,
                "$or": [
                    {"role": UserRole.ASSISTANT_MANAGER.value, "parent_id": current_user.id},
                    {"role": UserRole.EMPLOYEE.value, "parent_id": current_user.id},
                    {"role": UserRole.EMPLOYEE.value, "parent_id": {"$in": asm_ids}}
                ]
            }
        ).sort("-created_at").to_list()

    if arch in [BaseArchetype.ASSISTANT_MANAGER, UserRole.ASSISTANT_MANAGER]:
        # Find all employees reporting to this assistant manager
        return await User.find(
            User.role == UserRole.EMPLOYEE,
            User.parent_id == current_user.id,
            User.company_id == current_user.company_id
        ).sort("-created_at").to_list()

    return []


async def get_employee_by_id(employee_id: str) -> Optional[User]:
    """Get a specific employee by ID."""
    try:
        user = await User.get(PydanticObjectId(employee_id))
        if user and user.role != UserRole.SUPER_ADMIN:
            return user
    except Exception:
        pass
    return None


async def update_employee(employee_id: str, **kwargs) -> Optional[User]:
    """Update employee details."""
    try:
        user = await User.get(PydanticObjectId(employee_id))
    except Exception:
        return None
    if not user or user.role == UserRole.SUPER_ADMIN:
        return None

    update_data = {k: v for k, v in kwargs.items() if v is not None or k in ["parent_id", "company_id"]}
    
    if "email" in update_data and update_data["email"] != user.email:
        existing = await User.find_one(User.email == update_data["email"])
        if existing:
            raise ValueError("Email already registered to another user")

    if "password" in update_data:
        password = update_data.pop("password")
        if password is not None:
            update_data["password_hash"] = hash_password(password)

    if "parent_id" in update_data:
        p_id = update_data["parent_id"]
        try:
            update_data["parent_id"] = PydanticObjectId(p_id) if p_id else None
        except Exception:
            update_data["parent_id"] = None

    if "company_id" in update_data:
        c_id = update_data["company_id"]
        try:
            update_data["company_id"] = PydanticObjectId(c_id) if c_id else None
        except Exception:
            update_data["company_id"] = None

    if "role" in update_data and update_data["role"] is not None:
        role_val = update_data["role"]
        from app.models.role import CompanyRole, BaseArchetype
        
        comp_id = update_data.get("company_id") or user.company_id
        if isinstance(comp_id, str):
            try:
                comp_id = PydanticObjectId(comp_id)
            except Exception:
                comp_id = None

        db_role = None
        if comp_id:
            db_role = await CompanyRole.find_one(
                CompanyRole.company_id == comp_id,
                CompanyRole.display_name == role_val
            )
        if not db_role:
            try:
                arch_val = BaseArchetype(role_val)
                db_role = await CompanyRole.find_one(
                    CompanyRole.company_id == None,
                    CompanyRole.base_archetype == arch_val
                )
            except ValueError:
                pass
        
        if db_role:
            update_data["role_id"] = db_role.id
            update_data["role_display_name"] = db_role.display_name
            update_data["role_archetype"] = db_role.base_archetype
            update_data["role"] = UserRole(db_role.base_archetype.value)
        else:
            try:
                arch_val = BaseArchetype(role_val)
                update_data["role_archetype"] = arch_val
                update_data["role_display_name"] = role_val.replace("_", " ").title()
                update_data["role"] = UserRole(arch_val.value)
            except ValueError:
                update_data["role_archetype"] = BaseArchetype.EMPLOYEE
                update_data["role_display_name"] = "Employee"
                update_data["role"] = UserRole.EMPLOYEE

    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await user.set(update_data)

    try:
        return await User.get(PydanticObjectId(employee_id))
    except Exception:
        return None


async def deactivate_employee(employee_id: str) -> Optional[User]:
    """Deactivate an employee."""
    try:
        user = await User.get(PydanticObjectId(employee_id))
    except Exception:
        return None
    if not user or user.role == UserRole.SUPER_ADMIN:
        return None

    await user.set({"is_active": False, "updated_at": datetime.utcnow()})

    await ActivityLog(
        user_id=user.id,
        action="employee_deactivated",
        details=f"Employee {user.name} deactivated",
    ).insert()

    return user


async def get_employee_count() -> int:
    """Get total number of employees."""
    return await User.find(User.role != UserRole.ADMIN.value).count()


async def get_active_employee_count() -> int:
    """Get total number of active employees."""
    return await User.find(
        User.role != UserRole.ADMIN.value, User.is_active == True
    ).count()
