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


async def can_manage_task(current_user: User, task) -> bool:
    """Check if current_user has management rights over the task."""
    from app.models.user import UserRole
    if current_user.role == UserRole.SUPER_ADMIN:
        return True
    if current_user.role == UserRole.ADMIN:
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        return task.company_id in co_ids or task.company_id is None
    if current_user.role in [UserRole.MANAGER, UserRole.ASSISTANT_MANAGER]:
        # Task must be in their company
        if task.company_id != current_user.company_id:
            return False
        # User created the task
        if task.created_by == current_user.id:
            return True
        # Or assignee is a subordinate
        from app.routes.employees import check_hierarchy
        assignee = await User.get(task.assigned_to)
        if assignee and await check_hierarchy(current_user, assignee):
            return True
    return False


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    request: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a new task. Supports multiple assignees, multiple companies, and recurrence."""
    
    # 1. Determine target employees based on hierarchy
    target_employees = []
    if current_user.role == UserRole.ADMIN:
        if request.for_all:
            target_employees = await User.find(User.role != UserRole.ADMIN, User.is_active == True).to_list()
        elif request.assigned_to_list:
            target_employees = await User.find(In(User.id, [PydanticObjectId(uid) for uid in request.assigned_to_list])).to_list()
        elif request.assigned_to:
            emp = await User.get(PydanticObjectId(request.assigned_to))
            if emp: target_employees = [emp]
            
    elif current_user.role == UserRole.MANAGER:
        asms = await User.find(User.role == UserRole.ASSISTANT_MANAGER, User.parent_id == current_user.id).to_list()
        asm_ids = [asm.id for asm in asms]
        subordinates = await User.find(
            {
                "is_active": True,
                "$or": [
                    {"role": UserRole.ASSISTANT_MANAGER.value, "parent_id": current_user.id},
                    {"role": UserRole.EMPLOYEE.value, "parent_id": current_user.id},
                    {"role": UserRole.EMPLOYEE, "parent_id": {"$in": asm_ids}}
                ]
            }
        ).to_list()
        subordinate_ids = {emp.id for emp in subordinates}
        
        if request.for_all:
            target_employees = subordinates
        elif request.assigned_to_list:
            requested = [PydanticObjectId(uid) for uid in request.assigned_to_list]
            for uid in requested:
                if uid != current_user.id and uid not in subordinate_ids:
                    raise HTTPException(status_code=403, detail="Cannot assign task to users outside your hierarchy.")
            target_employees = await User.find(In(User.id, requested)).to_list()
        elif request.assigned_to:
            uid = PydanticObjectId(request.assigned_to)
            if uid != current_user.id and uid not in subordinate_ids:
                raise HTTPException(status_code=403, detail="Cannot assign task to users outside your hierarchy.")
            emp = await User.get(uid)
            if emp: target_employees = [emp]
            
    elif current_user.role == UserRole.ASSISTANT_MANAGER:
        subordinates = await User.find(User.role == UserRole.EMPLOYEE, User.parent_id == current_user.id, User.is_active == True).to_list()
        subordinate_ids = {emp.id for emp in subordinates}
        
        if request.for_all:
            target_employees = subordinates
        elif request.assigned_to_list:
            requested = [PydanticObjectId(uid) for uid in request.assigned_to_list]
            for uid in requested:
                if uid != current_user.id and uid not in subordinate_ids:
                    raise HTTPException(status_code=403, detail="Cannot assign task to users outside your hierarchy.")
            target_employees = await User.find(In(User.id, requested)).to_list()
        elif request.assigned_to:
            uid = PydanticObjectId(request.assigned_to)
            if uid != current_user.id and uid not in subordinate_ids:
                raise HTTPException(status_code=403, detail="Cannot assign task to users outside your hierarchy.")
            emp = await User.get(uid)
            if emp: target_employees = [emp]
            
    else: # EMPLOYEE
        target_employees = [current_user]

    # 2. Determine target companies
    target_companies = []
    if request.company_id_list:
        target_companies = [PydanticObjectId(cid) for cid in request.company_id_list]
    elif request.company_id:
        target_companies = [PydanticObjectId(request.company_id)]
    else:
        target_companies = [None]

    # Validate target companies
    if current_user.role == UserRole.ADMIN:
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        for cid in target_companies:
            if cid is not None and cid not in co_ids:
                raise HTTPException(status_code=403, detail="Not authorized to assign tasks to this company")
    elif current_user.role != UserRole.SUPER_ADMIN:
        for cid in target_companies:
            if cid is not None and cid != current_user.company_id:
                raise HTTPException(status_code=403, detail="Not authorized to assign tasks to this company")

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
                complexity=request.complexity,
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
    """Get tasks with strict hierarchical role-based filtering."""
    tasks = await task_service.get_tasks(
        current_user=current_user,
        user_id=employee_id,
        status=status_filter,
        priority=priority,
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
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    is_assignee = str(task.assigned_to) == str(current_user.id)
    is_management = current_user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ASSISTANT_MANAGER, UserRole.SUPER_ADMIN]

    if not is_assignee:
        if not is_management or not await can_manage_task(current_user, task):
            raise HTTPException(status_code=403, detail="Not authorized to update this task")
    else:
        has_restricted_changes = any(
            v is not None for k, v in {
                "work_description": request.work_description,
                "priority": request.priority,
                "complexity": request.complexity,
                "deadline": request.deadline,
                "category_ids": request.category_ids,
                "company_id": request.company_id,
                "assigned_to": request.assigned_to,
                "quality_multiplier": request.quality_multiplier,
            }.items()
        )
        if has_restricted_changes:
            if not is_management or not await can_manage_task(current_user, task):
                if task.company_id is not None:
                    raise HTTPException(status_code=403, detail="Not authorized to update administrative fields for this task")

    try:
        updated_task = await task_service.update_task(
            task_id=task_id,
            user_id=str(current_user.id),
            is_admin=is_management,
            work_description=request.work_description,
            status=request.status,
            priority=request.priority,
            complexity=request.complexity,
            deadline=request.deadline,
            remarks=request.remarks,
            category_ids=request.category_ids,
            company_id=request.company_id,
            assigned_to=request.assigned_to,
            quality_multiplier=request.quality_multiplier,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    if not updated_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    assigned_user = await User.get(updated_task.assigned_to)
    creator = await User.get(updated_task.created_by)
    company_name = await _resolve_company_name(updated_task.company_id)

    cat_names = []
    if updated_task.category_ids:
        categories = await Category.find({"_id": {"$in": updated_task.category_ids}}).to_list()
        cat_map = {cat.id: cat.name for cat in categories}
        cat_names = [cat_map[cid] for cid in updated_task.category_ids if cid in cat_map]

    return TaskResponse.from_task(
        updated_task,
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
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.ASSISTANT_MANAGER, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete tasks",
        )

    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if not await can_manage_task(current_user, task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this task",
        )

    success = await task_service.delete_task(task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return {"message": "Task deleted successfully"}
