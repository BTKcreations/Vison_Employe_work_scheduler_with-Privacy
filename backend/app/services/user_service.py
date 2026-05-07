"""
User/Employee service - business logic for user operations.
"""
from app.models.user import User, UserRole
from app.auth.password import hash_password
from app.models.activity_log import ActivityLog
from beanie import PydanticObjectId
from datetime import datetime
from typing import Optional, List


async def create_employee(name: str, email: str, password: str) -> User:
    """Create a new employee user."""
    existing = await User.find_one(User.email == email)
    if existing:
        raise ValueError("Email already registered")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        raw_password=password,
        role=UserRole.EMPLOYEE,
    )
    await user.insert()

    await ActivityLog(
        user_id=user.id,
        action="employee_created",
        details=f"Employee {name} created",
    ).insert()

    return user


async def get_all_employees() -> List[User]:
    """Get all employee users."""
    return await User.find(User.role == UserRole.EMPLOYEE).sort("-created_at").to_list()


async def get_employee_by_id(employee_id: str) -> Optional[User]:
    """Get a specific employee by ID."""
    user = await User.get(PydanticObjectId(employee_id))
    if user and user.role == UserRole.EMPLOYEE:
        return user
    return None


async def update_employee(employee_id: str, **kwargs) -> Optional[User]:
    """Update employee details."""
    user = await User.get(PydanticObjectId(employee_id))
    if not user or user.role != UserRole.EMPLOYEE:
        return None

    update_data = {k: v for k, v in kwargs.items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await user.set(update_data)

    return await User.get(PydanticObjectId(employee_id))


async def deactivate_employee(employee_id: str) -> Optional[User]:
    """Deactivate an employee."""
    user = await User.get(PydanticObjectId(employee_id))
    if not user or user.role != UserRole.EMPLOYEE:
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
    return await User.find(User.role == UserRole.EMPLOYEE).count()


async def get_active_employee_count() -> int:
    """Get total number of active employees."""
    return await User.find(
        User.role == UserRole.EMPLOYEE, User.is_active == True
    ).count()
