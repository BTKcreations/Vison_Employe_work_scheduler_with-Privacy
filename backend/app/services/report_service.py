"""
Report service - generates CSV and Excel reports using Pandas and OpenPyXL.
"""
import pandas as pd
from io import BytesIO
from app.models.task import Task
from app.models.user import User, UserRole
from beanie import PydanticObjectId
from datetime import datetime
from typing import Optional


async def _get_task_data(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    """Fetch and filter task data into a DataFrame."""
    query = {}

    if status:
        query["status"] = status
    if employee_id:
        query["assigned_to"] = PydanticObjectId(employee_id)
    if priority:
        query["priority"] = priority
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date)}

    tasks = await Task.find(query).sort("-created_at").to_list()

    # Resolve user names
    user_cache = {}
    rows = []
    for task in tasks:
        # Get assigned user name
        if str(task.assigned_to) not in user_cache:
            user = await User.get(task.assigned_to)
            user_cache[str(task.assigned_to)] = user.name if user else "Unknown"

        # Get creator name
        if str(task.created_by) not in user_cache:
            creator = await User.get(task.created_by)
            user_cache[str(task.created_by)] = creator.name if creator else "Unknown"

        rows.append({
            "Task ID": str(task.id),
            "Title": task.title,
            "Description": task.description or "",
            "Assigned To": user_cache[str(task.assigned_to)],
            "Created By": user_cache[str(task.created_by)],
            "Status": task.status.value,
            "Priority": task.priority.value,
            "Type": task.task_type.value,
            "Deadline": task.deadline.strftime("%Y-%m-%d %H:%M"),
            "Completed At": task.completed_at.strftime("%Y-%m-%d %H:%M") if task.completed_at else "",
            "Reward Given": "Yes" if task.reward_given else "No",
            "Created At": task.created_at.strftime("%Y-%m-%d %H:%M"),
        })

    return pd.DataFrame(rows)


async def generate_tasks_csv(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> str:
    """Generate CSV string of task data."""
    df = await _get_task_data(status, employee_id, priority, start_date, end_date)
    return df.to_csv(index=False)


async def generate_tasks_excel(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> BytesIO:
    """Generate Excel file of task data."""
    df = await _get_task_data(status, employee_id, priority, start_date, end_date)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Tasks", index=False)
    output.seek(0)
    return output


async def generate_employees_excel() -> BytesIO:
    """Generate Excel file of employee data with reward info."""
    employees = await User.find(User.role == UserRole.EMPLOYEE).sort("-reward_points").to_list()

    rows = []
    for emp in employees:
        # Get task counts for this employee
        total_tasks = await Task.find(Task.assigned_to == emp.id).count()
        completed_tasks = await Task.find(
            Task.assigned_to == emp.id, Task.status == "completed"
        ).count()
        pending_tasks = await Task.find(
            Task.assigned_to == emp.id, Task.status == "pending"
        ).count()

        rows.append({
            "Employee ID": str(emp.id),
            "Name": emp.name,
            "Email": emp.email,
            "Status": "Active" if emp.is_active else "Inactive",
            "Reward Points": emp.reward_points,
            "Total Tasks": total_tasks,
            "Completed Tasks": completed_tasks,
            "Pending Tasks": pending_tasks,
            "Completion Rate": f"{(completed_tasks / total_tasks * 100):.1f}%" if total_tasks > 0 else "0%",
            "Joined": emp.created_at.strftime("%Y-%m-%d"),
        })

    df = pd.DataFrame(rows)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Employees", index=False)
    output.seek(0)
    return output
