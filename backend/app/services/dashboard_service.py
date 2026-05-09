"""
Dashboard service - analytics and summary data for dashboards.
"""
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.activity_log import ActivityLog
from app.services.task_service import get_task_counts
from app.services.reward_service import get_leaderboard
from beanie import PydanticObjectId
from datetime import datetime


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
    low_priority = await Task.find(Task.priority == "low").count()
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
            "low": low_priority,
        },
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

    return {
        "user": {
            "name": user.name,
            "email": user.email,
            "reward_points": user.reward_points,
        },
        "tasks": task_counts,
        "recent_activity": activity_list,
        "rewards_earned": rewards_earned,
    }
