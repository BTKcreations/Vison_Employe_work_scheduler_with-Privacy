"""
Task management routes - CRUD for tasks.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse
from app.services import task_service
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.company import Company
from beanie import PydanticObjectId
from beanie.operators import In
from typing import List, Optional
from app.models.category import Category

router = APIRouter(prefix="/tasks", tags=["Task Management"])


async def _resolve_company_name(company_id) -> Optional[str]:
    """Resolve company name from company_id."""
    if not company_id:
        return None
    company = await Company.get(company_id)
    return company.name if company else None


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    request: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a new task. Supports multiple assignees, multiple companies, and recurrence."""
    
    # 1. Determine target employees
    target_employees = []
    if request.for_all:
        target_employees = await User.find(User.role == UserRole.EMPLOYEE, User.is_active == True).to_list()
    elif request.assigned_to_list:
        target_employees = await User.find(In(User.id, [PydanticObjectId(uid) for uid in request.assigned_to_list])).to_list()
    elif request.assigned_to:
        emp = await User.get(PydanticObjectId(request.assigned_to))
        if emp: target_employees = [emp]

    if not target_employees and not request.is_recurrent:
        # If not management, assigned_to is self
        if current_user.role != UserRole.ADMIN:
            target_employees = [current_user]
        else:
            raise HTTPException(status_code=400, detail="No valid employees selected.")

    # 2. Determine target companies
    target_companies = []
    if request.company_id_list:
        target_companies = [PydanticObjectId(cid) for cid in request.company_id_list]
    elif request.company_id:
        target_companies = [PydanticObjectId(request.company_id)]
    else:
        target_companies = [None]

    # 3. Handle Recurrence Registration
    recurring_rule = None
    if request.is_recurrent and request.recurrence:
        recurring_rule = RecurrenceRule(
            work_description=request.work_description,
            priority=request.priority,
            assigned_to_list=[emp.id for emp in target_employees],
            company_id_list=[cid for cid in target_companies if cid],
            created_by=current_user.id,
            type=RecurrenceType(request.recurrence.type),
            interval=request.recurrence.interval,
            weekdays=request.recurrence.weekdays,
            month_day=request.recurrence.month_day,
            end_type=RecurrenceEndType(request.recurrence.end_type),
            end_value=request.recurrence.end_value,
            next_run=request.deadline # First occurrence is the provided deadline
        )
        await recurring_rule.insert()

    # 4. Create initial task instances
    last_task = None
    for cid in target_companies:
        for emp in target_employees:
            last_task = await task_service.create_task(
                work_description=request.work_description,
                assigned_to=str(emp.id),
                created_by=str(current_user.id),
                priority=request.priority,
                deadline=request.deadline,
                task_type="assigned" if emp.id != current_user.id else "personal",
                company_id=str(cid) if cid else None,
                recurring_task_id=recurring_rule.id if recurring_rule else None,
                category_ids=request.category_ids,
            )

    if not last_task:
        raise HTTPException(status_code=400, detail="Failed to create tasks.")

    # Resolve names for response (using the last created task)
    assigned_user = await User.get(last_task.assigned_to)
    creator = await User.get(last_task.created_by)
    company_name = await _resolve_company_name(last_task.company_id)

    # Resolve categories
    cat_names = []
    for cid in (last_task.category_ids or []):
        cat = await Category.get(cid)
        if cat:
            cat_names.append(cat.name)

    return TaskResponse.from_task(
        last_task,
        assigned_name=assigned_user.name if assigned_user else None,
        creator_name=creator.name if creator else None,
        company_name=company_name,
        category_names=cat_names,
    )


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Get tasks. Admins see all; employees see only their own."""
    is_management = current_user.role == UserRole.ADMIN
    
    # If not management, they can only see their own tasks
    target_user_id = str(current_user.id) if not is_management else employee_id
    
    tasks = await task_service.get_tasks(
        user_id=target_user_id,
        status=status_filter,
        priority=priority,
        is_admin=is_management,
    )

    # Batch resolve related entity names
    user_ids = set()
    company_ids = set()
    category_ids_set = set()
    
    for task in tasks:
        user_ids.add(task.assigned_to)
        user_ids.add(task.created_by)
        if task.company_id:
            company_ids.add(task.company_id)
        for cid in (task.category_ids or []):
            category_ids_set.add(cid)

    # Parallel batch fetching
    import asyncio
    users_data, companies_data, categories_data = await asyncio.gather(
        User.find({"_id": {"$in": list(user_ids)}}).to_list(),
        Company.find({"_id": {"$in": list(company_ids)}}).to_list(),
        Category.find({"_id": {"$in": list(category_ids_set)}}).to_list()
    )

    user_map = {u.id: u.name for u in users_data}
    company_map = {c.id: c.name for c in companies_data}
    category_map = {cat.id: cat.name for cat in categories_data}

    result = []
    for task in tasks:
        # Resolve category names from map
        cat_names = [category_map.get(cid, "Unknown") for cid in (task.category_ids or [])]

        result.append(TaskResponse.from_task(
            task,
            assigned_name=user_map.get(task.assigned_to, "Unknown"),
            creator_name=user_map.get(task.created_by, "Unknown"),
            company_name=company_map.get(task.company_id) if task.company_id else None,
            category_names=cat_names,
        ))

    return result


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    request: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
):
    """Update a task. Employees can only update their own tasks."""
    is_management = current_user.role == UserRole.ADMIN
    try:
        task = await task_service.update_task(
            task_id=task_id,
            user_id=str(current_user.id),
            is_admin=is_management,
            work_description=request.work_description,
            status=request.status,
            priority=request.priority,
            deadline=request.deadline,
            remarks=request.remarks,
            category_ids=request.category_ids,
            company_id=request.company_id,
            assigned_to=request.assigned_to,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    assigned_user = await User.get(task.assigned_to)
    creator = await User.get(task.created_by)
    company_name = await _resolve_company_name(task.company_id)

    cat_names = []
    for cid in (task.category_ids or []):
        cat = await Category.get(cid)
        if cat:
            cat_names.append(cat.name)

    return TaskResponse.from_task(
        task,
        assigned_name=assigned_user.name if assigned_user else None,
        creator_name=creator.name if creator else None,
        company_name=company_name,
        category_names=cat_names,
    )


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a task (management only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete tasks",
        )

    success = await task_service.delete_task(task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return {"message": "Task deleted successfully"}
