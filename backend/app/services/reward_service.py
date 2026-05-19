"""
Reward service - handles reward point calculation and assignment.
"""
from datetime import datetime
from app.models.task import Task
from app.models.user import User
from app.models.activity_log import ActivityLog
from beanie import PydanticObjectId
from typing import Optional


async def check_and_award_reward(task: Task) -> bool:
    """
    Check if a completed task qualifies for a reward point using dynamic SystemSettings.
    Returns True if reward was given.
    """
    if not task.completed_at or task.reward_given:
        return False

    from app.models.system_settings import SystemSettings
    import math

    settings = None
    if task.company_id:
        settings = await SystemSettings.find_one(SystemSettings.company_id == task.company_id)
    if not settings:
        settings = await SystemSettings.find_one({"singleton_id": "default"})
    if not settings:
        settings = SystemSettings()

    # 1. Base Points = Priority * Complexity
    base_points = settings.priority_points.get(task.priority.value, 1.0)
    complexity_mult = settings.complexity_multipliers.get(task.complexity, 1.0)
    points = base_points * complexity_mult

    # 2. Time Variance
    variance_hours = (task.deadline - task.completed_at).total_seconds() / 3600.0

    if variance_hours >= 24:
        points *= settings.early_completion_bonus
    elif variance_hours < 0:
        # Task is late
        days_late = abs(variance_hours) / 24.0
        days_late_ceil = math.ceil(days_late)

        if days_late_ceil == 1:
            points *= settings.delay_reductions.get("1", 0.75)
        elif days_late_ceil == 2:
            points *= settings.delay_reductions.get("2", 0.50)
        elif days_late_ceil == 3:
            points *= settings.delay_reductions.get("3", 0.25)
        else:
            points *= settings.delay_reductions.get("4", 0.0)

    # 3. Quality Multiplier
    points *= task.quality_multiplier

    # 4. Round to 2 decimals
    points = round(points, 2)

    update_result = await Task.find(
        Task.id == task.id,
        Task.reward_given == False
    ).update({"$set": {
        "reward_given": True,
        "reward_points": points,
        "time_variance_hours": round(variance_hours, 2)
    }})

    if update_result.modified_count == 0:
        return False

    user = await User.get(task.assigned_to)
    if user:
        await User.find(User.id == user.id).update({"$inc": {"reward_points": points}})

        # Log the reward
        await ActivityLog(
            user_id=user.id,
            action="reward_earned",
            task_id=task.id,
            details=f"Earned {points} reward points for completing '{task.work_description[:30]}...'",
        ).insert()

        return True

    return False


async def get_leaderboard(limit: int = 10, current_user: Optional[User] = None):
    """Get top employees by reward points, filtered by company/hierarchy privacy."""
    from app.models.user import UserRole
    from beanie.operators import In

    if not current_user or current_user.role == UserRole.SUPER_ADMIN:
        # Super Admin sees everyone
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN,
            User.is_active == True,
        ).sort("-reward_points").limit(limit).to_list()
    elif current_user.role == UserRole.ADMIN:
        # Admin sees employees in companies they manage
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = [c.id for c in companies]
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN,
            User.role != UserRole.ADMIN,
            User.is_active == True,
            In(User.company_id, co_ids)
        ).sort("-reward_points").limit(limit).to_list()
    else:
        # Managers, ASM, and Employees only see peers in their own company
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN,
            User.role != UserRole.ADMIN,
            User.is_active == True,
            User.company_id == current_user.company_id
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

async def calculate_employee_performance(user_id: PydanticObjectId, start_date: datetime, end_date: datetime):
    """
    Calculate performance percentage, handle Overdue Accumulation (negative incentives),
    and determine the final incentive multiplier based on tiers.
    """
    from app.models.system_settings import SystemSettings
    from app.models.task import TaskStatus
    user = await User.get(user_id)
    settings = None
    if user and user.company_id:
        settings = await SystemSettings.find_one(SystemSettings.company_id == user.company_id)
    if not settings:
        settings = await SystemSettings.find_one({"singleton_id": "default"})
    if not settings:
        settings = SystemSettings()

    tasks_in_period = await Task.find(
        Task.assigned_to == user_id,
        Task.deadline >= start_date,
        Task.deadline <= end_date
    ).to_list()

    overdue_count = 0
    total_earned_points = 0.0
    total_possible_points = 0.0

    for task in tasks_in_period:
        base = settings.priority_points.get(task.priority.value, 1.0)
        mult = settings.complexity_multipliers.get(task.complexity, 1.0)
        total_possible_points += (base * mult)
        
        if task.status in (TaskStatus.COMPLETED, TaskStatus.COMPLETED_LATE):
            total_earned_points += task.reward_points

        if task.completed_at:
            variance_hours = (task.deadline - task.completed_at).total_seconds() / 3600.0
        else:
            variance_hours = (task.deadline - datetime.utcnow()).total_seconds() / 3600.0

        if variance_hours < 0:
            days_late = abs(variance_hours) / 24.0
            if days_late >= 4:
                overdue_count += 1

    performance_percent = (total_earned_points / total_possible_points * 100) if total_possible_points > 0 else 0.0
    
    # Overdue accumulation deduction
    deduction = 0.0
    if overdue_count > settings.negative_incentive_threshold:
        deduction = settings.negative_incentive_deduction * 100
        performance_percent = max(0, performance_percent - deduction)

    # Determine incentive tier
    incentive_multiplier = 0.0
    for threshold_str, multiplier in sorted(settings.incentive_tiers.items(), key=lambda x: float(x[0]), reverse=True):
        if performance_percent >= float(threshold_str):
            incentive_multiplier = multiplier
            break

    return {
        "total_possible_points": round(total_possible_points, 2),
        "total_earned_points": round(total_earned_points, 2),
        "performance_percent": round(performance_percent, 2),
        "overdue_count": overdue_count,
        "deduction_applied": deduction,
        "incentive_multiplier": incentive_multiplier
    }
