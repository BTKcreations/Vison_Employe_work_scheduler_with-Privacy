"""
Task management routes - CRUD for tasks.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse
from app.services import task_service
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.company import Company
from typing import List, Optional

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
    """Create a new task. Admins can assign to anyone; employees create personal tasks."""
    if request.for_all:
        employees = await User.find(User.role == UserRole.EMPLOYEE, User.is_active == True).to_list()
        
        last_task = None
        for emp in employees:
            last_task = await task_service.create_task(
                work_description=request.work_description,
                assigned_to=str(emp.id),
                created_by=str(current_user.id),
                priority=request.priority,
                deadline=request.deadline,
                task_type="assigned",
                company_id=request.company_id,
            )
        
        if not last_task:
             # Fallback if no employees found
             raise HTTPException(status_code=400, detail="No active employees found to assign task to.")
        
        task = last_task
    else:
        if current_user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
            assigned_to = request.assigned_to or str(current_user.id)
            task_type = "assigned" if request.assigned_to else "personal"
        else:
            # Employees can only assign to themselves
            assigned_to = str(current_user.id)
            task_type = "personal"

        task = await task_service.create_task(
            work_description=request.work_description,
            assigned_to=assigned_to,
            created_by=str(current_user.id),
            priority=request.priority,
            deadline=request.deadline,
            task_type=task_type,
            company_id=request.company_id,
        )

    # Resolve names
    assigned_user = await User.get(task.assigned_to)
    creator = await User.get(task.created_by)
    company_name = await _resolve_company_name(task.company_id)

    return TaskResponse.from_task(
        task,
        assigned_name=assigned_user.name if assigned_user else None,
        creator_name=creator.name if creator else None,
        company_name=company_name,
    )


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Get tasks. Admins see all; employees see only their own."""
    is_management = current_user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]
    
    # If not management, they can only see their own tasks
    target_user_id = str(current_user.id) if not is_management else employee_id
    
    tasks = await task_service.get_tasks(
        user_id=target_user_id,
        status=status_filter,
        priority=priority,
        is_admin=is_management,
    )

    # Resolve names with caching
    user_cache = {}
    company_cache = {}
    result = []
    for task in tasks:
        # Resolve Assigned To name
        if str(task.assigned_to) not in user_cache:
            user = await User.get(task.assigned_to)
            user_cache[str(task.assigned_to)] = user.name if user else "Unknown"
            
        # Resolve Created By name
        if str(task.created_by) not in user_cache:
            creator = await User.get(task.created_by)
            user_cache[str(task.created_by)] = creator.name if creator else "Unknown"

        # Resolve company name
        comp_name = None
        if task.company_id:
            cid = str(task.company_id)
            if cid not in company_cache:
                company = await Company.get(task.company_id)
                company_cache[cid] = company.name if company else None
            comp_name = company_cache[cid]

        result.append(TaskResponse.from_task(
            task,
            assigned_name=user_cache.get(str(task.assigned_to)),
            creator_name=user_cache.get(str(task.created_by)),
            company_name=comp_name,
        ))

    return result


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    request: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
):
    """Update a task. Employees can only update their own tasks."""
    is_management = current_user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]
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

    return TaskResponse.from_task(
        task,
        assigned_name=assigned_user.name if assigned_user else None,
        creator_name=creator.name if creator else None,
        company_name=company_name,
    )


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a task (management only)."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
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
