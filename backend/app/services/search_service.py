"""
Search service - cross-collection searching with tenant and role segregation.
"""
import re

from app.models.user import User, UserRole
from app.models.task import Task
from app.models.company import Company
from typing import List, Dict, Any
from beanie.operators import In

from app.services.authorization_service import (
    get_accessible_company_ids,
    get_accessible_user_ids,
    get_archetype_value,
)

async def global_search(query: str, current_user: User) -> Dict[str, List[Dict[str, Any]]]:
    """
    Search across employees, companies, and tasks, enforcing strict multi-tenancy and hierarchical boundaries.
    """
    normalized_query = (query or "").strip()
    if len(normalized_query) < 2:
        return {"employees": [], "companies": [], "tasks": []}

    search_filter = {"$regex": re.escape(normalized_query), "$options": "i"}
    arch = get_archetype_value(current_user)
    
    # 1. Search Employees
    if arch == "super_admin":
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN.value,
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
    elif arch in ["admin", "hr", "finance", "it", "auditor"]:
        user_ids = await get_accessible_user_ids(current_user)
        employees = await User.find(
            In(User.id, user_ids),
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
    elif arch in ["manager", "assistant_manager"]:
        user_ids = await get_accessible_user_ids(current_user)
        employees = await User.find(
            In(User.id, user_ids),
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
    else:
        # Employee can only search users in their own company to maintain privacy
        user_ids = await get_accessible_user_ids(current_user, employee_scope="company")
        employees = await User.find(
            In(User.id, user_ids),
            {"$or": [
                {"name": search_filter},
                {"email": search_filter}
            ]}
        ).limit(5).to_list()
        
    # 2. Search Companies
    if arch == "super_admin":
        companies = await Company.find({"name": search_filter}).limit(5).to_list()
    elif arch in ["admin", "hr", "finance", "it", "auditor"]:
        company_ids = await get_accessible_company_ids(current_user)
        companies = await Company.find(
            In(Company.id, company_ids),
            {"name": search_filter}
        ).limit(5).to_list()
    else:
        # Others can only see their own company
        companies = await Company.find(
            Company.id == current_user.company_id,
            {"name": search_filter}
        ).limit(5).to_list()
    
    # 3. Search Tasks
    if arch == "super_admin":
        tasks = await Task.find({"work_description": search_filter}).limit(5).to_list()
    elif arch in ["admin", "hr", "finance", "it", "auditor"]:
        permissions = await current_user.get_permissions()
        if {"tasks:create", "tasks:assign", "tasks:qa"}.intersection(permissions):
            company_ids = await get_accessible_company_ids(current_user)
            tasks = await Task.find(
                In(Task.company_id, company_ids),
                {"work_description": search_filter}
            ).limit(5).to_list()
        else:
            tasks = []
    elif arch in ["manager", "assistant_manager"]:
        user_ids = await get_accessible_user_ids(current_user)
        tasks = await Task.find(
            {"work_description": search_filter},
            {"$or": [
                {"assigned_to": {"$in": user_ids}},
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
