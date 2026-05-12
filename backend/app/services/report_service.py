"""
Report service - generates CSV and Excel reports using Pandas and OpenPyXL.
"""
import pandas as pd
from io import BytesIO
from app.models.task import Task
from app.models.attendance import Attendance
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
    """Fetch and filter task data into a DataFrame with specific SaaS requirements."""
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

    rows = []
    for i, task in enumerate(tasks, 1):
        # Calculate Time Variance (Deadline - Completed Time)
        time_variance = ""
        if task.completed_at:
            variance = task.deadline - task.completed_at
            hours = variance.total_seconds() / 3600
            if hours > 0:
                time_variance = f"{hours:.1f}h Early"
            else:
                time_variance = f"{abs(hours):.1f}h Late"

        # Format Remarks (Join all remark texts)
        remarks_str = " | ".join([r.get("text", "") for r in task.remarks]) if task.remarks else ""

        rows.append({
            "s.no": i,
            "employee name": task.assigned_to_name or "Unknown",
            "company name": task.company_name or "Personal / Internal",
            "work description": task.work_description,
            "work priority": task.priority.value,
            "dead-line": task.deadline.strftime("%d-%m-%Y %H:%M:%S"),
            "completed time": task.completed_at.strftime("%d-%m-%Y %H:%M:%S") if task.completed_at else "",
            "Time variance": time_variance,
            "Status": task.status.value,
            "Remarks": remarks_str,
            "points": 1 if task.status == "completed" else 0,
            "created time": task.created_at.strftime("%d-%m-%Y %H:%M:%S"),
            "Assigned by": task.created_by_name or "Unknown"
        })

    df = pd.DataFrame(rows)
    # Convert all column names to UPPERCASE as per requirement
    df.columns = [str(c).upper() for c in df.columns]
    return df


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

        rows.append({
            "Employee ID": str(emp.id),
            "Name": emp.name,
            "Email": emp.email,
            "Status": "Active" if emp.is_active else "Inactive",
            "Reward Points": emp.reward_points,
            "Total Tasks": total_tasks,
            "Completed Tasks": completed_tasks,
            "Completion Rate": f"{(completed_tasks / total_tasks * 100):.1f}%" if total_tasks > 0 else "0%",
            "Joined": emp.created_at.strftime("%d-%m-%Y %H:%M:%S"),
        })

    df = pd.DataFrame(rows)
    # Convert all column names to UPPERCASE as per requirement
    df.columns = [str(c).upper() for c in df.columns]
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Employees", index=False)
    output.seek(0)
    return output


async def generate_attendance_excel(
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> BytesIO:
    """Generate Excel file of attendance data."""
    query = {}
    if user_id:
        query["user_id"] = PydanticObjectId(user_id)
    
    if start_date:
        query["check_in"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "check_in" in query:
            query["check_in"]["$lte"] = datetime.fromisoformat(end_date)
        else:
            query["check_in"] = {"$lte": datetime.fromisoformat(end_date)}

    records = await Attendance.find(query).sort("-check_in").to_list()

    # Pre-fetch user names if needed
    user_map = {}
    if not user_id:
        user_ids = list(set([r.user_id for r in records]))
        users = await User.find({"_id": {"$in": user_ids}}).to_list()
        user_map = {u.id: {"name": u.name, "email": u.email} for u in users}

    rows = []
    for i, rec in enumerate(records, 1):
        # Calculate duration if checked out
        duration_str = ""
        if rec.check_out:
            diff = rec.check_out - rec.check_in
            hours = diff.total_seconds() / 3600
            duration_str = f"{hours:.2f}h"

        row = {
            "S.No": i,
            "Date": rec.check_in.strftime("%d-%m-%Y"),
        }

        if not user_id:
            user_info = user_map.get(rec.user_id, {"name": "Unknown", "email": "Unknown"})
            row["Employee Name"] = user_info["name"]
            row["Email"] = user_info["email"]

        row.update({
            "Check In": rec.check_in.strftime("%H:%M:%S"),
            "Check Out": rec.check_out.strftime("%H:%M:%S") if rec.check_out else "N/A",
            "Duration": duration_str,
            "Status": rec.status.upper(),
            "Address (In)": rec.address_in or "",
            "Address (Out)": rec.address_out or "",
            "Remarks": rec.remarks or ""
        })
        rows.append(row)

    df = pd.DataFrame(rows)
    # Convert all column names to UPPERCASE
    df.columns = [str(c).upper() for c in df.columns]
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Attendance", index=False)
    output.seek(0)
    return output
