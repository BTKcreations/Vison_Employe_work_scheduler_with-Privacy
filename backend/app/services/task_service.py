"""
Task service - business logic for task operations.
"""
from app.models.task import Task, TaskStatus, TaskPriority, TaskType
from app.models.user import User
from app.models.company import Company
from app.models.activity_log import ActivityLog
from app.services.reward_service import check_and_award_reward
from beanie import PydanticObjectId
from datetime import datetime
from typing import Optional, List


async def create_task(
    work_description: str,
    assigned_to: str,
    created_by: str,
    priority: str,
    deadline: datetime,
    task_type: str = "assigned",
    company_id: Optional[str] = None,
) -> Task:
    """Create a new task."""
    assigned_user = await User.get(PydanticObjectId(assigned_to))
    creator_user = await User.get(PydanticObjectId(created_by))
    company = await Company.get(PydanticObjectId(company_id)) if company_id else None

    task = Task(
        work_description=work_description,
        assigned_to=PydanticObjectId(assigned_to),
        assigned_to_name=assigned_user.name if assigned_user else "Unknown",
        created_by=PydanticObjectId(created_by),
        created_by_name=creator_user.name if creator_user else "Unknown",
        priority=TaskPriority(priority),
        task_type=TaskType(task_type),
        deadline=deadline,
        company_id=PydanticObjectId(company_id) if company_id else None,
        company_name=company.name if company else None,
    )
    await task.insert()

    await ActivityLog(
        user_id=PydanticObjectId(created_by),
        action="task_created",
        task_id=task.id,
        details=f"Work '{work_description[:50]}...' assigned to {assigned_user.name if assigned_user else 'Unknown'}",
    ).insert()

    return task


async def get_tasks(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    is_admin: bool = False,
) -> List[Task]:
    """Get tasks with optional filters."""
    query = {}

    if (not is_admin and user_id) or (is_admin and user_id):
        query["assigned_to"] = PydanticObjectId(user_id)

    if status:
        query["status"] = status

    if priority:
        query["priority"] = priority

    tasks = await Task.find(query).sort("-created_at").to_list()

    # Auto-mark overdue tasks
    now = datetime.utcnow()
    for task in tasks:
        if task.status in [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] and task.deadline < now:
            await task.set({"status": TaskStatus.OVERDUE, "updated_at": now})
            task.status = TaskStatus.OVERDUE

    return tasks


async def get_task_by_id(task_id: str) -> Optional[Task]:
    """Get a specific task by ID."""
    return await Task.get(PydanticObjectId(task_id))


async def update_task(task_id: str, user_id: str, is_admin: bool, **kwargs) -> Optional[Task]:
    """Update a task. Handles status changes, remarks, and reward logic."""
    task = await Task.get(PydanticObjectId(task_id))
    if not task:
        return None

    # Non-admin can only update their own tasks
    if not is_admin and str(task.assigned_to) != user_id:
        raise PermissionError("Cannot update tasks assigned to other users")

    # Handle remarks separately — they are appended, not replaced
    remark_text = kwargs.pop("remarks", None)

    update_data = {}
    for key, value in kwargs.items():
        if value is not None:
            if key == "status":
                update_data["status"] = TaskStatus(value)
            elif key == "priority":
                update_data["priority"] = TaskPriority(value)
            else:
                update_data[key] = value

    # Append remark if provided
    if remark_text:
        user = await User.get(PydanticObjectId(user_id))
        new_remark = {
            "user_id": user_id,
            "user_name": user.name if user else "Unknown",
            "text": remark_text,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        current_remarks = task.remarks or []
        current_remarks.append(new_remark)
        update_data["remarks"] = current_remarks

    # Handle completion
    new_status = update_data.get("status")
    if new_status == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
        now = datetime.utcnow()
        update_data["completed_at"] = now
        # If past deadline, set status to COMPLETED_LATE
        if task.deadline < now:
            update_data["status"] = TaskStatus.COMPLETED_LATE

    update_data["updated_at"] = datetime.utcnow()
    await task.set(update_data)

    # Reload the task
    task = await Task.get(PydanticObjectId(task_id))

    # Check for reward if task was just completed (only on-time completion gets reward)
    final_status = update_data.get("status", task.status)
    if final_status == TaskStatus.COMPLETED:
        await check_and_award_reward(task)

        await ActivityLog(
            user_id=task.assigned_to,
            action="task_completed",
            task_id=task.id,
            details=f"Work '{task.work_description[:50]}...' completed",
        ).insert()

    return task


async def delete_task(task_id: str) -> bool:
    """Delete a task."""
    task = await Task.get(PydanticObjectId(task_id))
    if not task:
        return False
    await task.delete()
    return True


async def get_task_counts(user_id: Optional[str] = None):
    """Get task count summary."""
    base_query = {}
    if user_id:
        base_query["assigned_to"] = PydanticObjectId(user_id)

    # Auto-update overdue tasks first
    now = datetime.utcnow()
    overdue_tasks = await Task.find(
        {**base_query, "status": {"$in": ["pending", "in_progress"]}, "deadline": {"$lt": now}}
    ).to_list()
    for task in overdue_tasks:
        await task.set({"status": TaskStatus.OVERDUE})

    total = await Task.find(base_query).count()
    completed = await Task.find({**base_query, "status": "completed"}).count()
    completed_late = await Task.find({**base_query, "status": "completed_late"}).count()
    pending = await Task.find({**base_query, "status": "pending"}).count()
    in_progress = await Task.find({**base_query, "status": "in_progress"}).count()
    overdue = await Task.find({**base_query, "status": "overdue"}).count()

    return {
        "total": total,
        "completed": completed,
        "completed_late": completed_late,
        "pending": pending,
        "in_progress": in_progress,
        "overdue": overdue,
    }
