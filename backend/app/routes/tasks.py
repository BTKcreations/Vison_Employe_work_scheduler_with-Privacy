"""
Task management routes - CRUD for tasks.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse, RecurrenceRuleResponse, UpdateRecurrenceRuleRequest
from app.services import task_service
from app.auth.dependencies import get_current_user, has_permission
from app.models.user import User, UserRole
from app.models.company import Company
from beanie import PydanticObjectId
from beanie.operators import In
from typing import List, Optional
from app.models.category import Category
from app.models.recurring_task import RecurrenceRule, RecurrenceType, RecurrenceEndType
from app.services.authorization_service import (
    can_access_task,
    get_archetype_value,
    is_management_user,
)

router = APIRouter(prefix="/tasks", tags=["Task Management"])


async def _resolve_company_name(company_id) -> Optional[str]:
    """Resolve company name from company_id."""
    if not company_id:
        return None
    company = await Company.get(company_id)
    return company.name if company else None


async def can_manage_task(current_user: User, task) -> bool:
    """Check if current_user has management rights over the task."""
    return await can_access_task(current_user, task, action="manage")



@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    request: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a new task. Supports multiple assignees, multiple companies, and recurrence."""
    can_create = await has_permission(current_user, "tasks:create")
    can_assign = await has_permission(current_user, "tasks:assign")

    is_assigning_others = bool(request.for_all or request.assigned_to_list)
    if request.assigned_to:
        is_assigning_others = is_assigning_others or str(request.assigned_to) != str(current_user.id)

    # A user can always create a personal task (assigned to self, no company scope) without tasks:create permission
    is_personal = not is_assigning_others and not request.company_id and not request.company_id_list

    if not is_personal and not can_create:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing required permission: tasks:create")
    if is_assigning_others and not can_assign:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing required permission: tasks:assign")
    
    # 1. Determine target employees based on hierarchy
    target_employees = []
    arch_str = get_archetype_value(current_user)

    if arch_str in ["admin", "super_admin", "hr", "finance", "it", "auditor"]:
        scoped_user_query = {"is_active": True}
        if arch_str != "super_admin":
            companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
            co_ids = [c.id for c in companies]
            scoped_user_query["company_id"] = {"$in": co_ids}

        if request.for_all:
            target_employees = await User.find({
                **scoped_user_query,
                "role": {"$nin": [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]}
            }).to_list()
        elif request.assigned_to_list:
            requested_ids = [PydanticObjectId(uid) for uid in request.assigned_to_list]
            target_employees = await User.find(In(User.id, requested_ids)).to_list()
            if arch_str != "super_admin":
                for emp in target_employees:
                    if emp.id != current_user.id and emp.company_id not in scoped_user_query["company_id"]["$in"]:
                        raise HTTPException(status_code=403, detail="Cannot assign task to users outside your company scope.")
        elif request.assigned_to:
            emp = await User.get(PydanticObjectId(request.assigned_to))
            if emp:
                if arch_str != "super_admin" and emp.id != current_user.id and emp.company_id not in scoped_user_query["company_id"]["$in"]:
                    raise HTTPException(status_code=403, detail="Cannot assign task to users outside your company scope.")
                target_employees = [emp]
            
    elif arch_str == "manager":
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
            
    elif arch_str == "assistant_manager":
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
        if (request.assigned_to and PydanticObjectId(request.assigned_to) != current_user.id) or \
           (request.assigned_to_list and any(PydanticObjectId(uid) != current_user.id for uid in request.assigned_to_list)) or \
           request.for_all:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to assign tasks to other users",
            )
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
    arch_str = get_archetype_value(current_user)

    if arch_str in ["admin", "hr", "finance", "it", "auditor"]:
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        for cid in target_companies:
            if cid is not None and cid not in co_ids:
                raise HTTPException(status_code=403, detail="Not authorized to assign tasks to this company")
    elif arch_str != "super_admin":
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


@router.get("/recurring", response_model=List[RecurrenceRuleResponse])
async def list_recurring_rules(
    current_user: User = Depends(get_current_user),
):
    """List all recurring task rules."""
    from app.models.company import Company
    
    arch_str = get_archetype_value(current_user)

    if arch_str == "super_admin":
        rules = await RecurrenceRule.find_all().to_list()
    elif arch_str in ["admin", "hr", "finance", "it", "auditor"]:
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = [c.id for c in companies]
        rules = await RecurrenceRule.find(
            {
                "$or": [
                    {"company_id_list": {"$in": co_ids}},
                    {"created_by": current_user.id}
                ]
            }
        ).to_list()
    elif arch_str in ["manager", "assistant_manager"]:
        rules = await RecurrenceRule.find(
            {
                "$or": [
                    {"company_id_list": current_user.company_id},
                    {"created_by": current_user.id}
                ]
            }
        ).to_list()
    else:
        rules = await RecurrenceRule.find(
            {
                "$or": [
                    {"assigned_to_list": current_user.id},
                    {"created_by": current_user.id}
                ]
            }
        ).to_list()

    return [
        RecurrenceRuleResponse(
            id=str(r.id),
            work_description=r.work_description,
            priority=r.priority,
            reward_points=r.reward_points,
            assigned_to_list=[str(uid) for uid in r.assigned_to_list],
            company_id_list=[str(cid) for cid in r.company_id_list],
            created_by=str(r.created_by),
            type=r.type.value,
            interval=r.interval,
            weekdays=r.weekdays,
            month_day=r.month_day,
            end_type=r.end_type.value,
            end_value=r.end_value,
            next_run=r.next_run.isoformat() + "Z",
            last_run=r.last_run.isoformat() + "Z" if r.last_run else None,
            occurrence_count=r.occurrence_count,
            is_active=r.is_active,
            created_at=r.created_at.isoformat() + "Z",
        )
        for r in rules
    ]


@router.patch("/recurring/{rule_id}", response_model=RecurrenceRuleResponse)
async def update_recurring_rule(
    rule_id: str,
    request: UpdateRecurrenceRuleRequest,
    current_user: User = Depends(get_current_user),
):
    """Update a recurring task rule."""
    rule = await RecurrenceRule.get(PydanticObjectId(rule_id))
    if not rule:
        raise HTTPException(status_code=404, detail="Recurrence rule not found")
        
    can_edit = False
    arch = current_user.role_archetype or current_user.role
    arch_str = arch.value if hasattr(arch, "value") else str(arch)

    if arch_str == "super_admin":
        can_edit = True
    elif str(rule.created_by) == str(current_user.id):
        can_edit = True
    elif arch_str in ["admin", "hr", "finance", "it", "auditor"]:
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if any(cid in co_ids for cid in rule.company_id_list):
            can_edit = True
            
    if not can_edit:
        raise HTTPException(status_code=403, detail="Not authorized to update this recurring rule")

    update_data = {}
    if request.work_description is not None:
        update_data["work_description"] = request.work_description
    if request.priority is not None:
        update_data["priority"] = request.priority
    if request.reward_points is not None:
        update_data["reward_points"] = request.reward_points
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    if request.type is not None:
        update_data["type"] = RecurrenceType(request.type)
    if request.interval is not None:
        update_data["interval"] = request.interval
    if request.weekdays is not None:
        update_data["weekdays"] = request.weekdays
    if request.month_day is not None:
        update_data["month_day"] = request.month_day
    if request.end_type is not None:
        update_data["end_type"] = RecurrenceEndType(request.end_type)
    if request.end_value is not None:
        update_data["end_value"] = request.end_value

    if update_data:
        await rule.set(update_data)
        rule = await RecurrenceRule.get(PydanticObjectId(rule_id))

    return RecurrenceRuleResponse(
        id=str(rule.id),
        work_description=rule.work_description,
        priority=rule.priority,
        reward_points=rule.reward_points,
        assigned_to_list=[str(uid) for uid in rule.assigned_to_list],
        company_id_list=[str(cid) for cid in rule.company_id_list],
        created_by=str(rule.created_by),
        type=rule.type.value,
        interval=rule.interval,
        weekdays=rule.weekdays,
        month_day=rule.month_day,
        end_type=rule.end_type.value,
        end_value=rule.end_value,
        next_run=rule.next_run.isoformat() + "Z",
        last_run=rule.last_run.isoformat() + "Z" if rule.last_run else None,
        occurrence_count=rule.occurrence_count,
        is_active=rule.is_active,
        created_at=rule.created_at.isoformat() + "Z",
    )


@router.delete("/recurring/{rule_id}")
async def delete_recurring_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a recurring task rule."""
    rule = await RecurrenceRule.get(PydanticObjectId(rule_id))
    if not rule:
        raise HTTPException(status_code=404, detail="Recurrence rule not found")

    can_delete = False
    arch = current_user.role_archetype or current_user.role
    arch_str = arch.value if hasattr(arch, "value") else str(arch)

    if arch_str == "super_admin":
        can_delete = True
    elif str(rule.created_by) == str(current_user.id):
        can_delete = True
    elif arch_str in ["admin", "hr", "finance", "it", "auditor"]:
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if any(cid in co_ids for cid in rule.company_id_list):
            can_delete = True

    if not can_delete:
        raise HTTPException(status_code=403, detail="Not authorized to delete this recurring rule")

    await rule.delete()
    return {"message": "Recurring task rule deleted successfully"}


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
    is_management = is_management_user(current_user)

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
            is_personal = task.company_id is None or task.task_type.value == "personal" or str(task.created_by) == str(task.assigned_to)
            if is_personal:
                if request.assigned_to is not None and request.assigned_to != str(current_user.id):
                    raise HTTPException(status_code=403, detail="Cannot assign personal tasks to other users")
                if request.quality_multiplier is not None:
                    raise HTTPException(status_code=403, detail="Cannot set quality multiplier on tasks")
            else:
                if not is_management or not await can_manage_task(current_user, task):
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
    for cid in (updated_task.category_ids or []):
        cat = await Category.get(cid)
        if cat:
            cat_names.append(cat.name)

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
    arch_str = get_archetype_value(current_user)

    if arch_str not in ["admin", "manager", "assistant_manager", "super_admin", "hr", "finance", "it", "auditor"]:
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
