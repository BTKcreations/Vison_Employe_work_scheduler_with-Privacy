"""
Report service - generates CSV and Excel reports using Pandas and OpenPyXL.
"""
import pandas as pd
from io import BytesIO
from app.models.task import Task
from app.models.attendance import Attendance
from app.models.user import User, UserRole
from beanie import PydanticObjectId
from datetime import datetime, timezone
from typing import Optional
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo


def _scope(q: dict, tenant_id) -> dict:
    """Append tenant_id filter; refuse if missing (tenant isolation)."""
    if tenant_id is None:
        return q
    q["tenant_id"] = tenant_id
    return q


async def _scope_tasks(q: dict, tenant_id) -> dict:
    """Append tenant_id or company_id filter for tasks; refuse if missing (tenant isolation)."""
    if tenant_id is None:
        return q
    from app.models.company import Company
    tenant_oid = PydanticObjectId(tenant_id)
    companies = await Company.find(Company.tenant_id == tenant_oid).to_list()
    company_ids = [c.id for c in companies]
    tenant_match_ids = [tenant_oid] + company_ids
    q["tenant_id"] = {"$in": tenant_match_ids}
    return q


async def _get_task_data(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tz_name: Optional[str] = None,
    tenant_id = None,
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

    query = await _scope_tasks(query, tenant_id)

    # Performance Optimization: Using raw PyMongo collection access and projections to bypass Beanie overhead.
    projection = {
        "assigned_to_name": 1,
        "company_name": 1,
        "category_names": 1,
        "work_description": 1,
        "priority": 1,
        "deadline": 1,
        "completed_at": 1,
        "status": 1,
        "remarks": 1,
        "created_at": 1,
        "created_by_name": 1
    }
    tasks = await Task.get_pymongo_collection().find(query, projection).sort("created_at", -1).to_list(length=100000)

    rows = []
    # Determine timezone for formatting
    tz = ZoneInfo(tz_name) if tz_name else None

    def fmt_dt(dt: datetime) -> str:
        """Format datetime in local timezone if provided."""
        if dt is None:
            return ""
        # Handle naive datetimes from MongoDB if necessary (though they should be UTC)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if tz:
            dt = dt.astimezone(tz)
        return dt.strftime("%d-%m-%Y %H:%M:%S")

    for i, task in enumerate(tasks, 1):
        # Calculate Time Variance (Deadline - Completed Time)
        time_variance = ""
        completed_at = task.get("completed_at")
        deadline = task.get("deadline")
        if completed_at and deadline:
            # Ensure both are UTC-aware for comparison if they aren't already
            if completed_at.tzinfo is None:
                completed_at = completed_at.replace(tzinfo=timezone.utc)
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)

            variance = deadline - completed_at
            hours = variance.total_seconds() / 3600
            if hours > 0:
                time_variance = f"{hours:.1f}h Early"
            else:
                time_variance = f"{abs(hours):.1f}h Late"

        # Format Remarks (Join all remark texts)
        remarks_list = task.get("remarks") or []
        remarks_str = " | ".join([r.get("text", "") for r in remarks_list if isinstance(r, dict)])

        status_val = str(task.get("status", ""))
        rows.append({
            "s.no": i,
            "employee name": task.get("assigned_to_name") or "Unknown",
            "company name": task.get("company_name") or "Personal / Internal",
            "category": ", ".join(task.get("category_names", [])) if task.get("category_names") else "",
            "work description": task.get("work_description"),
            "work priority": str(task.get("priority", "")).capitalize(),
            "dead-line": fmt_dt(deadline),
            "completed time": fmt_dt(completed_at) if completed_at else "",
            "Time variance": time_variance,
            "Status": status_val.capitalize(),
            "Remarks": remarks_str,
            "points": 1 if status_val == "completed" else 0,
            "created time": fmt_dt(task.get("created_at")),
            "Assigned by": task.get("created_by_name") or "Unknown"
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
    tz_name: Optional[str] = None,
    tenant_id = None,
) -> str:
    """Generate CSV string of task data."""
    df = await _get_task_data(status, employee_id, priority, start_date, end_date, tz_name, tenant_id=tenant_id)
    return df.to_csv(index=False)


async def generate_tasks_excel(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tz_name: Optional[str] = None,
    tenant_id = None,
) -> BytesIO:
    """Generate Excel file of task data."""
    df = await _get_task_data(status, employee_id, priority, start_date, end_date, tz_name, tenant_id=tenant_id)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Tasks", index=False)
    output.seek(0)
    return output


async def generate_employees_excel(tenant_id=None) -> BytesIO:
    """Generate Excel file of employee data with reward info."""
    user_q = {"role": UserRole.EMPLOYEE.value}
    user_q = _scope(user_q, tenant_id)
    # Performance Optimization: Using raw PyMongo collection access and projections to bypass Beanie overhead.
    projection = {"_id": 1, "name": 1, "email": 1, "is_active": 1, "reward_points": 1, "created_at": 1}
    employees = await User.get_pymongo_collection().find(user_q, projection).sort("reward_points", -1).to_list(length=100000)
    employee_ids = [emp["_id"] for emp in employees]

    if not employee_ids:
        df = pd.DataFrame(columns=[
            "EMPLOYEE ID", "NAME", "EMAIL", "STATUS",
            "REWARD POINTS", "TOTAL TASKS", "COMPLETED TASKS",
            "COMPLETION RATE", "JOINED"
        ])
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Employees", index=False)
        output.seek(0)
        return output

    # Optimized batch task count using aggregation
    task_match = {"assigned_to": {"$in": employee_ids}}
    task_match = await _scope_tasks(task_match, tenant_id)
    pipeline = [
        {"$match": task_match},
        {"$group": {
            "_id": "$assigned_to",
            "total_tasks": {"$sum": 1},
            "completed_tasks": {
                "$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}
            }
        }}
    ]
    task_stats_list = await Task.get_pymongo_collection().aggregate(pipeline).to_list(length=100000)
    task_stats_map = {str(stat["_id"]): stat for stat in task_stats_list}

    rows = []
    for emp in employees:
        stats = task_stats_map.get(str(emp["_id"]), {"total_tasks": 0, "completed_tasks": 0})
        total_tasks = stats["total_tasks"]
        completed_tasks = stats["completed_tasks"]

        rows.append({
            "Employee ID": str(emp["_id"]),
            "Name": emp.get("name"),
            "Email": emp.get("email"),
            "Status": "Active" if emp.get("is_active") else "Inactive",
            "Reward Points": emp.get("reward_points", 0),
            "Total Tasks": total_tasks,
            "Completed Tasks": completed_tasks,
            "Completion Rate": f"{(completed_tasks / total_tasks * 100):.1f}%" if total_tasks > 0 else "0%",
            "Joined": emp.get("created_at").strftime("%d-%m-%Y %H:%M:%S") if emp.get("created_at") else "",
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
    tz_name: Optional[str] = None,
    tenant_id = None,
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

    query = _scope(query, tenant_id)

    # Performance Optimization: Using raw PyMongo collection access and projections to bypass Beanie overhead.
    att_projection = {"user_id": 1, "check_in": 1, "check_out": 1, "status": 1, "address_in": 1, "address_out": 1, "remarks": 1}
    records = await Attendance.get_pymongo_collection().find(query, att_projection).sort("check_in", -1).to_list(length=100000)

    # Pre-fetch user names if needed
    user_map = {}
    if not user_id and records:
        user_ids = list(set([r["user_id"] for r in records]))
        user_q = {"_id": {"$in": user_ids}}
        user_q = _scope(user_q, tenant_id)
        user_projection = {"_id": 1, "name": 1, "email": 1}
        users = await User.get_pymongo_collection().find(user_q, user_projection).to_list(length=100000)
        user_map = {u["_id"]: {"name": u.get("name"), "email": u.get("email")} for u in users}

    # Determine timezone for formatting
    tz = ZoneInfo(tz_name) if tz_name else None

    def to_local(dt: datetime) -> datetime:
        """Convert a UTC datetime to local timezone."""
        if dt is None:
            return None
        if tz:
            return dt.replace(tzinfo=timezone.utc).astimezone(tz)
        return dt

    rows = []
    for i, rec in enumerate(records, 1):
        check_in = rec.get("check_in")
        check_out = rec.get("check_out")

        # Ensure UTC-aware
        if check_in and check_in.tzinfo is None:
            check_in = check_in.replace(tzinfo=timezone.utc)
        if check_out and check_out.tzinfo is None:
            check_out = check_out.replace(tzinfo=timezone.utc)

        local_check_in = to_local(check_in)
        local_check_out = to_local(check_out) if check_out else None

        # Calculate duration if checked out
        duration_str = ""
        if check_in and check_out:
            diff = check_out - check_in
            hours = diff.total_seconds() / 3600
            duration_str = f"{hours:.2f}h"

        row = {
            "S.No": i,
            "Date": local_check_in.strftime("%d-%m-%Y") if local_check_in else "",
        }

        if not user_id:
            user_info = user_map.get(rec["user_id"], {"name": "Unknown", "email": "Unknown"})
            row["Employee Name"] = user_info["name"]
            row["Email"] = user_info["email"]

        row.update({
            "Check In": local_check_in.strftime("%H:%M:%S") if local_check_in else "",
            "Check Out": local_check_out.strftime("%H:%M:%S") if local_check_out else "N/A",
            "Duration": duration_str,
            "Status": str(rec.get("status", "")).upper(),
            "Address (In)": rec.get("address_in") or "",
            "Address (Out)": rec.get("address_out") or "",
            "Remarks": rec.get("remarks") or ""
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


async def generate_leaves_excel(user_id: Optional[str] = None, tenant_id=None) -> BytesIO:
    """Generate Excel file of leave requests."""
    from app.models.leave import Leave
    
    query = {}
    if user_id:
        query["user_id"] = PydanticObjectId(user_id)
        
    query = _scope(query, tenant_id)
    # Performance Optimization: Using raw PyMongo collection access and projections to bypass Beanie overhead.
    leave_projection = {
        "user_id": 1, "user_name": 1, "leave_type": 1, "start_date": 1, "end_date": 1,
        "status": 1, "reason": 1, "comments": 1, "verified_by_name": 1, "approved_by_name": 1, "created_at": 1
    }
    leaves = await Leave.get_pymongo_collection().find(query, leave_projection).sort("created_at", -1).to_list(length=100000)
    
    # Pre-fetch user names
    user_map = {}
    if not user_id and leaves:
        user_ids = list(set([l["user_id"] for l in leaves]))
        user_q = {"_id": {"$in": user_ids}}
        user_q = _scope(user_q, tenant_id)
        user_projection = {"_id": 1, "name": 1, "email": 1}
        users = await User.get_pymongo_collection().find(user_q, user_projection).to_list(length=100000)
        user_map = {u["_id"]: {"name": u.get("name"), "email": u.get("email")} for u in users}
        
    rows = []
    for i, l in enumerate(leaves, 1):
        row = {
            "S.No": i,
        }
        if not user_id:
            user_info = user_map.get(l["user_id"], {"name": l.get("user_name") or "Unknown", "email": "Unknown"})
            row["Employee Name"] = user_info["name"]
            row["Email"] = user_info["email"]
            
        start_date = l.get("start_date")
        end_date = l.get("end_date")
        days = 0
        if start_date and end_date:
            days = (end_date - start_date).days + 1

        row.update({
            "Leave Type": str(l.get("leave_type", "")).upper(),
            "Start Date": start_date.strftime("%d-%m-%Y") if start_date else "",
            "End Date": end_date.strftime("%d-%m-%Y") if end_date else "",
            "Total Days": days,
            "Status": str(l.get("status", "")).upper(),
            "Reason": l.get("reason"),
            "Comments": l.get("comments") or "",
            "Verified By": l.get("verified_by_name") or "",
            "Approved By": l.get("approved_by_name") or "",
            "Created Date": l.get("created_at").strftime("%d-%m-%Y %H:%M:%S") if l.get("created_at") else ""
        })
        rows.append(row)
        
    df = pd.DataFrame(rows)
    df.columns = [str(c).upper() for c in df.columns]
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Leaves", index=False)
    output.seek(0)
    return output


async def generate_reward_ledger_excel(user_id: Optional[str] = None, tenant_id=None) -> BytesIO:
    """Generate Excel file of reward points ledger entries."""
    from app.models.ledger import RewardLedgerEntry
    
    query = {}
    if user_id:
        query["user_id"] = PydanticObjectId(user_id)
        
    query = _scope(query, tenant_id)
    # Performance Optimization: Using raw PyMongo collection access and projections to bypass Beanie overhead.
    ledger_projection = {"user_id": 1, "amount": 1, "transaction_type": 1, "description": 1, "created_at": 1}
    entries = await RewardLedgerEntry.get_pymongo_collection().find(query, ledger_projection).sort("created_at", -1).to_list(length=100000)
    
    # Pre-fetch user names
    user_map = {}
    if entries:
        user_ids = list(set([e["user_id"] for e in entries]))
        user_q = {"_id": {"$in": user_ids}}
        user_q = _scope(user_q, tenant_id)
        user_projection = {"_id": 1, "name": 1, "email": 1}
        users = await User.get_pymongo_collection().find(user_q, user_projection).to_list(length=100000)
        user_map = {u["_id"]: {"name": u.get("name"), "email": u.get("email")} for u in users}
    
    rows = []
    for i, e in enumerate(entries, 1):
        user_info = user_map.get(e["user_id"], {"name": "Unknown", "email": "Unknown"})
        row = {
            "S.No": i,
            "Employee Name": user_info["name"],
            "Email": user_info["email"],
            "Amount": e.get("amount"),
            "Transaction Type": str(e.get("transaction_type", "")).upper(),
            "Description": e.get("description") or "",
            "Timestamp": e.get("created_at").strftime("%d-%m-%Y %H:%M:%S") if e.get("created_at") else ""
        }
        rows.append(row)
        
    df = pd.DataFrame(rows)
    df.columns = [str(c).upper() for c in df.columns]
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Reward Points Ledger", index=False)
    output.seek(0)
    return output


async def generate_audit_excel(actor_id: Optional[str] = None, entity_type: Optional[str] = None, tenant_id=None) -> BytesIO:
    """Generate Excel file of audit log events."""
    from app.models.audit_event import AuditEvent
    
    query = {}
    if actor_id:
        query["actor_id"] = PydanticObjectId(actor_id)
    if entity_type:
        query["entity_type"] = entity_type
        
    query = _scope(query, tenant_id)
    # Performance Optimization: Using raw PyMongo collection access and projections to bypass Beanie overhead.
    audit_projection = {
        "actor_name": 1, "actor_role": 1, "action": 1, "entity_type": 1, "entity_id": 1,
        "correlation_id": 1, "ip_address": 1, "user_agent": 1, "timestamp": 1
    }
    events = await AuditEvent.get_pymongo_collection().find(query, audit_projection).sort("timestamp", -1).to_list(length=100000)
    
    rows = []
    for i, e in enumerate(events, 1):
        row = {
            "S.No": i,
            "Actor Name": e.get("actor_name") or "System",
            "Actor Role": e.get("actor_role") or "System",
            "Action": str(e.get("action", "")).upper(),
            "Entity Type": str(e.get("entity_type", "")).upper(),
            "Entity ID": str(e.get("entity_id")) if e.get("entity_id") else "",
            "Correlation ID": e.get("correlation_id") or "",
            "IP Address": e.get("ip_address") or "",
            "User Agent": e.get("user_agent") or "",
            "Timestamp": e.get("timestamp").strftime("%d-%m-%Y %H:%M:%S") if e.get("timestamp") else ""
        }
        rows.append(row)
        
    df = pd.DataFrame(rows)
    df.columns = [str(c).upper() for c in df.columns]
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Audit Trails", index=False)
    output.seek(0)
    return output

