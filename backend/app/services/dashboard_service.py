"""
Dashboard service - analytics and summary data for dashboards.
"""
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.activity_log import ActivityLog
from app.services.task_service import get_task_counts
from app.services.reward_service import get_leaderboard
from app.models.attendance import Attendance
from beanie import PydanticObjectId
from datetime import datetime, timedelta


async def get_admin_dashboard():
    """Get admin dashboard analytics data."""
    total_employees = await User.find(User.role == UserRole.EMPLOYEE).count()
    active_employees = await User.find(
        User.role == UserRole.EMPLOYEE, User.is_active == True
    ).count()

    task_counts = await get_task_counts()
    leaderboard = await get_leaderboard(limit=5)

    # Task priority distribution
    high_priority = await Task.find(Task.priority == "high").count()
    medium_priority = await Task.find(Task.priority == "medium").count()
    regular_priority = await Task.find(Task.priority == "regular").count()
    critical_priority = await Task.find(Task.priority == "critical").count()

    # Recent activity
    recent_activities = await ActivityLog.find().sort("-timestamp").limit(10).to_list()
    activity_list = []
    for activity in recent_activities:
        user = await User.get(activity.user_id)
        activity_list.append({
            "id": str(activity.id),
            "user_id": str(activity.user_id),
            "user_name": user.name if user else "Unknown",
            "action": activity.action,
            "details": activity.details,
            "timestamp": activity.timestamp.isoformat() + "Z",
        })

    # Total rewards given
    total_rewards = await Task.find(Task.reward_given == True).count()

    return {
        "employees": {
            "total": total_employees,
            "active": active_employees,
        },
        "tasks": task_counts,
        "priority_distribution": {
            "critical": critical_priority,
            "high": high_priority,
            "medium": medium_priority,
            "regular": regular_priority,
        },
        "attendance_today": await _get_today_attendance_stats(total_employees),
        "leaderboard": leaderboard,
        "recent_activity": activity_list,
        "total_rewards_given": total_rewards,
    }


async def get_employee_dashboard(user_id: str):
    """Get employee personal dashboard data."""
    user = await User.get(PydanticObjectId(user_id))
    task_counts = await get_task_counts(user_id=user_id)

    # Recent activity for this employee
    recent_activities = await ActivityLog.find(
        ActivityLog.user_id == PydanticObjectId(user_id)
    ).sort("-timestamp").limit(10).to_list()

    activity_list = [
        {
            "id": str(a.id),
            "user_id": str(a.user_id),
            "user_name": user.name,
            "action": a.action,
            "details": a.details,
            "timestamp": a.timestamp.isoformat() + "Z",
        }
        for a in recent_activities
    ]

    # Rewards earned
    rewards_earned = await Task.find(
        Task.assigned_to == PydanticObjectId(user_id),
        Task.reward_given == True,
    ).count()

    # Priority distribution for this employee
    priority_distribution = {
        "critical": await Task.find(Task.assigned_to == PydanticObjectId(user_id), Task.priority == "critical").count(),
        "high": await Task.find(Task.assigned_to == PydanticObjectId(user_id), Task.priority == "high").count(),
        "medium": await Task.find(Task.assigned_to == PydanticObjectId(user_id), Task.priority == "medium").count(),
        "regular": await Task.find(Task.assigned_to == PydanticObjectId(user_id), Task.priority == "regular").count(),
    }

    # Attendance status today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    attendance = await Attendance.find_one(
        Attendance.user_id == PydanticObjectId(user_id),
        Attendance.check_in >= today_start
    )
    attendance_status = "present" if attendance else "absent"

    # Last 5 days attendance history
    attendance_history = []
    for i in range(5):
        day = today_start - timedelta(days=i)
        next_day = day + timedelta(days=1)
        record = await Attendance.find_one(
            Attendance.user_id == PydanticObjectId(user_id),
            Attendance.check_in >= day,
            Attendance.check_in < next_day
        )
        attendance_history.append({
            "date": day.isoformat() + "Z",
            "status": "present" if record else "absent"
        })
    attendance_history.reverse() # Show oldest to newest (last 5 days)

    # Last 90 days attendance history for detailed calendar
    attendance_history_detailed = []
    for i in range(90):
        day = today_start - timedelta(days=i)
        next_day = day + timedelta(days=1)
        record = await Attendance.find_one(
            Attendance.user_id == PydanticObjectId(user_id),
            Attendance.check_in >= day,
            Attendance.check_in < next_day
        )
        if record:
            attendance_history_detailed.append({
                "date": day.isoformat() + "Z",
                "status": "present"
            })
        elif (day.weekday() < 5): # Mon-Fri
             attendance_history_detailed.append({
                "date": day.isoformat() + "Z",
                "status": "absent"
            })

    return {
        "user": {
            "name": user.name,
            "email": user.email,
            "reward_points": user.reward_points,
            "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
            "mobile": user.mobile,
            "alternate_mobile": user.alternate_mobile,
        },
        "tasks": task_counts,
        "priority_distribution": priority_distribution,
        "recent_activity": activity_list,
        "rewards_earned": rewards_earned,
        "attendance_status": attendance_status,
        "attendance_history": attendance_history,
        "attendance_history_detailed": attendance_history_detailed,
    }

async def get_all_attendance_summary():
    """Get last 5 days attendance summary for all employees."""
    employees = await User.find(User.role == UserRole.EMPLOYEE).to_list()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    five_days_ago = today_start - timedelta(days=4)
    
    logs = await Attendance.find(Attendance.check_in >= five_days_ago).to_list()
    
    # Map logs by user_id and date
    log_map = {} 
    for log in logs:
        uid = str(log.user_id)
        date_str = log.check_in.date().isoformat()
        if uid not in log_map: log_map[uid] = {}
        log_map[uid][date_str] = "present"
        
    summary = []
    for emp in employees:
        uid = str(emp.id)
        history = []
        for i in range(5):
            day = today_start - timedelta(days=i)
            date_str = day.date().isoformat()
            history.append({
                "date": day.isoformat() + "Z",
                "status": log_map.get(uid, {}).get(date_str, "absent")
            })
        history.reverse()
        summary.append({
            "user_id": uid,
            "user_name": emp.name,
            "user_email": emp.email,
            "reward_points": emp.reward_points,
            "history": history
        })
    return summary


async def _get_today_attendance_stats(total_employees: int):
    """Helper to get today's attendance stats."""
    # Using UTC for consistent day boundaries or use local if specified. 
    # For now, let's use the start of the current UTC day.
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Unique users who checked in today
    present_records = await Attendance.find(
        Attendance.check_in >= today_start
    ).to_list()
    present_count = len({str(r.user_id) for r in present_records})
    absent_count = max(0, total_employees - present_count)
    
    return {
        "present": present_count,
        "absent": absent_count,
        "total": total_employees
    }
