"""
Search service - cross-collection searching with tenant and role segregation.
"""
from app.models.user import User, UserRole
from app.models.task import Task
from app.models.company import Company
from beanie import PydanticObjectId
from typing import List, Dict, Any

async def global_search(query: str, current_user: User) -> Dict[str, List[Dict[str, Any]]]:
    """
    Search across employees, companies, and tasks, enforcing strict multi-tenancy and hierarchical boundaries.
    """
    if not query or len(query) < 2:
        return {"employees": [], "companies": [], "tasks": []}

    search_filter = {"$regex": query, "$options": "i"}
    
    # 1. Search Employees
    if current_user.role == UserRole.SUPER_ADMIN:
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN,
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
    elif current_user.role == UserRole.ADMIN:
        # Admin can search all users in their managed companies
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = [c.id for c in companies]
        from beanie.operators import In
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN,
            In(User.company_id, co_ids),
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
    elif current_user.role in [UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
        # Managers can only search users in their company tree
        from app.services import user_service
        subordinates = await user_service.get_all_employees(current_user)
        sub_ids = [emp.id for emp in subordinates] + [current_user.id]
        from beanie.operators import In
        employees = await User.find(
            In(User.id, sub_ids),
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
    else:
        # Employee can only search users in their own company to maintain privacy
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN,
            User.company_id == current_user.company_id,
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
        
    # 2. Search Companies
    if current_user.role == UserRole.SUPER_ADMIN:
        companies = await Company.find({"name": search_filter}).limit(5).to_list()
    elif current_user.role == UserRole.ADMIN:
        # Admin can search only companies they manage
        companies = await Company.find(
            {"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]},
            {"name": search_filter}
        ).limit(5).to_list()
    else:
        # Others can only see their own company
        companies = await Company.find(
            Company.id == current_user.company_id,
            {"name": search_filter}
        ).limit(5).to_list()
    
    # 3. Search Tasks
    if current_user.role == UserRole.SUPER_ADMIN:
        tasks = await Task.find({"work_description": search_filter}).limit(5).to_list()
    elif current_user.role == UserRole.ADMIN:
        # Admin can search all tasks in their company/companies
        companies_owned = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = [c.id for c in companies_owned]
        from beanie.operators import In
        tasks = await Task.find(
            In(Task.company_id, co_ids),
            {"work_description": search_filter}
        ).limit(5).to_list()
    elif current_user.role in [UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
        # Manager / ASM can search tasks within their hierarchy
        from app.services import user_service
        subordinates = await user_service.get_all_employees(current_user)
        sub_ids = [emp.id for emp in subordinates] + [current_user.id]
        from beanie.operators import In
        tasks = await Task.find(
            {"work_description": search_filter},
            {"$or": [
                {"assigned_to": {"$in": sub_ids}},
                {"created_by": current_user.id}
            ]}
        ).limit(5).to_list()
    else:
        # Employee can only search their own tasks
        tasks = await Task.find(
            Task.assigned_to == current_user.id,
            {"work_description": search_filter}
        ).limit(5).to_list()
    
    return {
        "employees": [
            {"id": str(e.id), "name": e.name, "email": e.email, "type": "employee"}
            for e in employees
        ],
        "companies": [
            {"id": str(c.id), "name": c.name, "type": "company"}
            for c in companies
        ],
        "tasks": [
            {"id": str(t.id), "description": t.work_description, "status": t.status.value, "type": "task"}
            for t in tasks
        ]
    }
