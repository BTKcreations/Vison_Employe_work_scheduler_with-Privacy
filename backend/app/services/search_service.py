"""
Search service - cross-collection searching.
"""
from app.models.user import User, UserRole
from app.models.task import Task
from app.models.company import Company
from typing import List, Dict, Any

async def global_search(query: str, company_id: str = None) -> Dict[str, List[Dict[str, Any]]]:
    """
    Search across employees, companies, and tasks.
    """
    if not query or len(query) < 2:
        return {"employees": [], "companies": [], "tasks": []}

    search_filter = {"$regex": query, "$options": "i"}
    
    # 1. Search Employees
    employees = await User.find(
        User.role == UserRole.EMPLOYEE,
        {"$or": [
            {"name": search_filter},
            {"email": search_filter}
        ]}
    ).limit(5).to_list()
    
    # 2. Search Companies
    company_query = {"name": search_filter}
    if company_id:
        # If user belongs to a company, maybe they can only search their company?
        # But usually admin can search all.
        pass
    
    companies = await Company.find(company_query).limit(5).to_list()
    
    # 3. Search Tasks
    task_query = {"work_description": search_filter}
    # For tasks, we might want to search by assigned_to_name too if it's indexed
    tasks = await Task.find(task_query).limit(5).to_list()
    
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
