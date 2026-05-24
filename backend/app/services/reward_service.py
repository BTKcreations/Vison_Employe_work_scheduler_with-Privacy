"""
Reward service - handles reward point calculation and assignment.
"""
from datetime import datetime
from app.models.task import Task
from app.models.user import User
from app.models.activity_log import ActivityLog
from beanie import PydanticObjectId
from typing import Optional, List


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
            User.role != UserRole.SUPER_ADMIN.value,
            User.is_active == True,
        ).sort("-reward_points").limit(limit).to_list()
    elif current_user.role == UserRole.ADMIN:
        # Admin sees employees in companies they manage
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = [c.id for c in companies]
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN.value,
            User.role != UserRole.ADMIN.value,
            User.is_active == True,
            In(User.company_id, co_ids)
        ).sort("-reward_points").limit(limit).to_list()
    else:
        # Managers, ASM, and Employees only see peers in their own company
        employees = await User.find(
            User.role != UserRole.SUPER_ADMIN.value,
            User.role != UserRole.ADMIN.value,
            User.is_active == True,
            User.company_id == current_user.company_id
        ).sort("-reward_points").limit(limit).to_list()

    return [
        {
            "id": str(emp.id),
            "name": emp.name,
            "email": emp.email,
            "reward_points": float(emp.reward_points) if emp.reward_points is not None else 0.0,
            "role": emp.role.value if hasattr(emp.role, 'value') else str(emp.role)
        }
        for emp in employees
    ]

async def calculate_employee_performance(
    user_id: PydanticObjectId,
    start_date: datetime,
    end_date: datetime,
    tasks_list: Optional[List[Task]] = None
):
    """
    Calculate performance percentage, handle Overdue Accumulation (negative incentives),
    and determine the final incentive multiplier based on tiers.
    """
    from app.models.system_settings import SystemSettings
    from app.models.task import TaskStatus
    import math
    user = await User.get(user_id)
    settings = None
    if user and user.company_id:
        settings = await SystemSettings.find_one(SystemSettings.company_id == user.company_id)
    if not settings:
        settings = await SystemSettings.find_one({"singleton_id": "default"})
    if not settings:
        settings = SystemSettings()

    if tasks_list is not None:
        tasks_in_period = [t for t in tasks_list if str(t.assigned_to) == str(user_id)]
    else:
        tasks_in_period = await Task.find(
            {"assigned_to": user_id},
            {"$or": [
                {"completed_at": {"$gte": start_date, "$lte": end_date}},
                {"completed_at": None, "deadline": {"$gte": start_date, "$lte": end_date}}
            ]}
        ).to_list()

    overdue_count = 0
    total_earned_points = 0.0
    total_possible_points = 0.0

    start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
    end_date_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date

    for task in tasks_in_period:
        base = settings.priority_points.get(task.priority.value, 1.0)
        mult = settings.complexity_multipliers.get(task.complexity, 1.0)
        max_task_pts = base * mult

        is_completed_this_month = False
        task_completed_at = task.completed_at.replace(tzinfo=None) if task.completed_at and task.completed_at.tzinfo else task.completed_at
        if task_completed_at and start_date_naive <= task_completed_at <= end_date_naive:
            is_completed_this_month = True

        is_due_this_month = False
        task_deadline = task.deadline.replace(tzinfo=None) if task.deadline and task.deadline.tzinfo else task.deadline
        if task_deadline and start_date_naive <= task_deadline <= end_date_naive:
            is_due_this_month = True

        if is_completed_this_month:
            earned_pts = task.reward_points if task.reward_given and task.reward_points is not None else 0.0
            if not task.reward_given:
                earned_pts = max_task_pts * task.quality_multiplier
                if task.completed_at:
                    variance_hours = (task.deadline - task.completed_at).total_seconds() / 3600.0
                    if variance_hours >= 24:
                        earned_pts *= settings.early_completion_bonus
                    elif variance_hours < 0:
                        days_late_ceil = math.ceil(abs(variance_hours) / 24.0)
                        if days_late_ceil == 1:
                            earned_pts *= settings.delay_reductions.get("1", 0.75)
                        elif days_late_ceil == 2:
                            earned_pts *= settings.delay_reductions.get("2", 0.50)
                        elif days_late_ceil == 3:
                            earned_pts *= settings.delay_reductions.get("3", 0.25)
                        else:
                            earned_pts *= settings.delay_reductions.get("4", 0.0)
            total_earned_points += earned_pts

        if is_completed_this_month or is_due_this_month:
            total_possible_points += max_task_pts

        is_4_days_late = False
        if task.completed_at:
            if (task.completed_at - task.deadline).total_seconds() / 3600.0 > 96.0:
                is_4_days_late = True
        else:
            now = datetime.utcnow()
            if (now - task.deadline).total_seconds() / 3600.0 > 96.0:
                is_4_days_late = True

        if is_4_days_late:
            overdue_count += 1

    performance_percent = (total_earned_points / total_possible_points * 100) if total_possible_points > 0 else 0.0
    
    deduction = 0.0
    if overdue_count > settings.negative_incentive_threshold:
        deduction = settings.negative_incentive_deduction * 100
        performance_percent = max(0, performance_percent - deduction)

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
