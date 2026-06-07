from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.models.recurring_task import RecurrenceRule, RecurrenceType, RecurrenceEndType
from app.models.task import Task
from app.services import task_service
from beanie import PydanticObjectId
from typing import List, Optional

def calculate_next_run(rule: RecurrenceRule, start_time: datetime = None) -> datetime:
    """Calculate the next run time based on the recurrence rule."""
    current_next = start_time or rule.next_run or datetime.utcnow()
    
    if rule.type == RecurrenceType.DAILY:
        return current_next + relativedelta(days=rule.interval)
    
    if rule.type == RecurrenceType.WEEKLY:
        if not rule.weekdays:
            return current_next + relativedelta(weeks=rule.interval)
        
        # Find the next available weekday
        current_weekday = current_next.weekday()
        sorted_weekdays = sorted(rule.weekdays)
        
        for wd in sorted_weekdays:
            if wd > current_weekday:
                return current_next + relativedelta(days=wd - current_weekday)
        
        # If no more weekdays this week, go to the first weekday of the next interval week
        days_to_next_week = 7 - current_weekday + sorted_weekdays[0]
        return current_next + relativedelta(days=days_to_next_week, weeks=rule.interval - 1)

    if rule.type == RecurrenceType.MONTHLY:
        rule_day = rule.month_day
        if rule_day is None:
            rule_day = current_next.day
            rule.month_day = rule_day  # Persist it to prevent month-end calendar drift
            
        # relativedelta automatically handles month end clamping (e.g. 31st to 30th)
        # without drifting the base day for future months.
        # We need to preserve the rule_day logic.
        # relativedelta(months=rule.interval, day=rule_day) replaces the day with rule_day,
        # but clamps if the resulting month is shorter!
        return current_next + relativedelta(months=rule.interval, day=rule_day)

    if rule.type == RecurrenceType.YEARLY:
        return current_next + relativedelta(years=rule.interval)

    return current_next + relativedelta(days=1)

async def spawn_tasks_from_rule(rule: RecurrenceRule):
    """Create individual tasks from a recurring rule."""
    if not rule.is_active:
        return

    # Check end condition
    if rule.end_type == RecurrenceEndType.COUNT and rule.occurrence_count >= int(rule.end_value or 0):
        rule.is_active = False
        await rule.save()
        return
    
    if rule.end_type == RecurrenceEndType.DATE and datetime.utcnow() > datetime.fromisoformat(rule.end_value or ""):
        rule.is_active = False
        await rule.save()
        return

    # Calculate deadline for this run to enforce idempotency
    deadline = rule.next_run.replace(hour=23, minute=59, second=59, microsecond=0)

    # Check if we have already spawned tasks for this specific run
    existing_task = await Task.find_one(
        Task.recurring_task_id == rule.id,
        Task.deadline == deadline
    )
    if existing_task:
        # Already spawned tasks for this interval. Advance to prevent duplicates.
        rule.last_run = rule.next_run
        rule.next_run = calculate_next_run(rule)
        await rule.save()
        return

    # Determine assignees
    assigned_ids = rule.assigned_to_list
    company_ids = rule.company_id_list or [None]

    # Spawn tasks
    for cid in company_ids:
        for uid in assigned_ids:
            await task_service.create_task(
                work_description=rule.work_description,
                assigned_to=str(uid),
                created_by=str(rule.created_by),
                priority=rule.priority,
                deadline=deadline,
                task_type="assigned",
                company_id=str(cid) if cid else None,
                recurring_task_id=rule.id
            )

    # Update rule
    rule.last_run = rule.next_run
    rule.next_run = calculate_next_run(rule)
    rule.occurrence_count += 1
    await rule.save()

async def process_recurrence():
    """Background loop to check and spawn recurring tasks."""
    now = datetime.utcnow()
    pending_rules = await RecurrenceRule.find(
        RecurrenceRule.is_active == True,
        RecurrenceRule.next_run <= now
    ).to_list()
    
    for rule in pending_rules:
        # Safety limit to prevent spawning more than 5 task occurrences per rule in a single background cycle
        spawns = 0
        while rule.is_active and rule.next_run <= now and spawns < 5:
            await spawn_tasks_from_rule(rule)
            spawns += 1
