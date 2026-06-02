import logging
from datetime import datetime, timezone, timedelta
from app.models.task import Task, TaskStatus
from app.services.notification_service import NotificationService
from app.services.audit_service import AuditService
from beanie.operators import GTE, LTE, NE, And, Or, LT

_logger = logging.getLogger(__name__)


class NotificationJobService:
    @staticmethod
    async def process_task_reminders():
        """Send notifications for tasks due soon or overdue."""
        now = datetime.now(timezone.utc)
        due_soon_threshold = now + timedelta(hours=24)
        reminder_threshold = now - timedelta(hours=12) # Only remind every 12 hours

        # 1. Tasks due soon (within 24 hours)
        due_soon_tasks = await Task.find(
            And(
                Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
                Task.deadline <= due_soon_threshold,
                Task.deadline > now,
                Or(
                    Task.last_reminder_sent_at == None,
                    Task.last_reminder_sent_at <= reminder_threshold
                )
            )
        ).to_list()

        for task in due_soon_tasks:
            await NotificationService.notify_user(
                user_id=task.assigned_to,
                title="Task Due Soon",
                message=f"Task '{task.work_description[:50]}' is due within 24 hours (Deadline: {task.deadline.strftime('%Y-%m-%d %H:%M')}).",
                type="system",
            )
            task.last_reminder_sent_at = now
            await task.save()

        # 2. Overdue tasks
        overdue_tasks = await Task.find(
            And(
                Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
                LT(Task.deadline, now),
                Or(
                    Task.last_reminder_sent_at == None,
                    Task.last_reminder_sent_at <= reminder_threshold
                )
            )
        ).to_list()

        for task in overdue_tasks:
            # Notify assignee and creator
            await NotificationService.notify_user(
                user_id=task.assigned_to,
                title="Task Overdue",
                message=f"Task '{task.work_description[:50]}' is now overdue! Please update the status or request an extension.",
                type="system",
            )

            if task.created_by != task.assigned_to:
                await NotificationService.notify_user(
                    user_id=task.created_by,
                    title="Task Overdue Notification",
                    message=f"Task '{task.work_description[:50]}' assigned to {task.assigned_to_name} is overdue.",
                    type="system",
                )

            # Log audit event for escalation
            await AuditService.log_event(
                actor=None,  # System
                entity_type="task",
                entity_id=task.id,
                action="escalated",
                after_state={"status": "overdue", "assigned_to": str(task.assigned_to)},
            )

            task.last_reminder_sent_at = now
            await task.save()
