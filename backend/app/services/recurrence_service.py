from datetime import datetime, timedelta
from app.models.recurring_task import RecurrenceRule, RecurrenceType, RecurrenceEndType
from app.models.task import Task, TaskPriority, TaskType
from app.services import task_service
from beanie import PydanticObjectId
from typing import List, Optional

def calculate_next_run(rule: RecurrenceRule) -> datetime:
    """Calculate the next run time based on the recurrence rule."""
    now = datetime.utcnow()
    current_next = rule.next_run or now
    
    if rule.type == RecurrenceType.DAILY:
        return current_next + timedelta(days=rule.interval)
    
    if rule.type == RecurrenceType.WEEKLY:
        if not rule.weekdays:
            return current_next + timedelta(weeks=rule.interval)
        
        # Find the next available weekday
        current_weekday = current_next.weekday()
        sorted_weekdays = sorted(rule.weekdays)
        
        for wd in sorted_weekdays:
            if wd > current_weekday:
                return current_next + timedelta(days=wd - current_weekday)
        
        # If no more weekdays this week, go to the first weekday of the next interval week
        days_to_next_week = 7 - current_weekday + sorted_weekdays[0]
        return current_next + timedelta(days=days_to_next_week + (rule.interval - 1) * 7)

    if rule.type == RecurrenceType.MONTHLY:
        # Simple month increment
        month = current_next.month + rule.interval
        year = current_next.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        day = min(rule.month_day or current_next.day, 28) # Cap at 28 for simplicity
        return current_next.replace(year=year, month=month, day=day)

    return current_next + timedelta(days=1)

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

    # Determine assignees
    assigned_ids = rule.assigned_to_list
    company_ids = rule.company_id_list or [None]

    # Spawn tasks
    for cid in company_ids:
        for uid in assigned_ids:
            # Deadline is usually same day or X hours from next_run
            # For simplicity, we'll set deadline to end of next_run day
            deadline = rule.next_run.replace(hour=23, minute=59, second=59)
            
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
        await spawn_tasks_from_rule(rule)
