"""
Reward service - handles reward point calculation and assignment.
"""
from datetime import datetime
from app.models.task import Task
from app.models.user import User
from app.models.activity_log import ActivityLog
from beanie import PydanticObjectId


async def check_and_award_reward(task: Task) -> bool:
    """
    Check if a completed task qualifies for a reward point.
    
    Rule: If the task is completed before the deadline,
    the assigned employee earns +1 reward point.
    Tasks completed after the deadline (overdue) do NOT earn points.
    
    Returns True if reward was given.
    """
    if not task.completed_at or task.reward_given:
        return False

    # Check if completed before deadline
    if task.completed_at < task.deadline:
        # Award the reward point
        user = await User.get(task.assigned_to)
        if user:
            await user.set({
                "reward_points": user.reward_points + 1
            })
            await task.set({"reward_given": True})

            # Log the reward
            await ActivityLog(
                user_id=user.id,
                action="reward_earned",
                task_id=task.id,
                details=f"Earned 1 reward point for completing '{task.title}' before deadline",
            ).insert()

            return True

    return False


async def get_leaderboard(limit: int = 10):
    """Get top employees by reward points."""
    from app.models.user import UserRole
    employees = await User.find(
        User.role == UserRole.EMPLOYEE,
        User.is_active == True,
    ).sort("-reward_points").limit(limit).to_list()

    return [
        {
            "id": str(emp.id),
            "name": emp.name,
            "email": emp.email,
            "reward_points": emp.reward_points,
        }
        for emp in employees
    ]
