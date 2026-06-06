"""
Backfill `company_id` on all tenant-scoped collections.

For existing data that pre-dates the company_id field, derive the company
from the owning user (e.g. `user_id`, `assigned_to`, `created_by`, etc.)
and set it on each document. Documents whose owner cannot be resolved
across all tenants are left untouched (logged).
"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from beanie import PydanticObjectId
from app.database.connection import init_db
from app.models.user import User
from app.models.company import Company
from app.models.category import Category
from app.models.task import Task
from app.models.attendance import Attendance
from app.models.leave import Leave
from app.models.leave_balance import LeaveBalance
from app.models.payroll import Payroll, SalaryStructure, PayrollHistory
from app.models.payroll_impact import PayrollRecalculationImpact
from app.models.regularization import AttendanceRegularization
from app.models.chat_group import ChatGroup
from app.models.chat_message import ChatMessage
from app.models.notification import Notification
from app.models.notification_engine import NotificationPreference, NotificationDeliveryLog
from app.models.audit_event import AuditEvent
from app.models.activity_log import ActivityLog
from app.models.ai_insight import CachedAIInsight
from app.models.ledger import LeaveLedgerEntry, RewardLedgerEntry


async def backfill_users() -> int:
    """All non-platform-owner users should already have company_id from their creation flow."""
    n = 0
    async for u in User.find_all():
        if u.is_platform_owner or u.role == "platform_owner":
            continue
        if not u.company_id:
            continue
        n += 1
    return n


async def backfill_via_user(field: str, model, default_label: str) -> int:
    """Backfill company_id by joining the user that owns the doc."""
    updated = 0
    skipped = 0
    async for doc in model.find_all():
        if getattr(doc, "company_id", None) is not None:
            continue
        owner_id = getattr(doc, field, None)
        if not owner_id:
            skipped += 1
            continue
        try:
            owner = await User.get(PydanticObjectId(owner_id))
        except Exception:
            owner = None
        if not owner or not owner.company_id:
            skipped += 1
            continue
        doc.company_id = owner.company_id
        await doc.save()
        updated += 1
    return updated


async def backfill_via_sender(field: str, model) -> int:
    updated = 0
    async for doc in model.find_all():
        if getattr(doc, "company_id", None) is not None:
            continue
        sender_id = getattr(doc, field, None)
        if not sender_id:
            continue
        sender = await User.get(PydanticObjectId(sender_id))
        if sender and sender.company_id:
            doc.company_id = sender.company_id
            await doc.save()
            updated += 1
    return updated


async def backfill_chat_groups() -> int:
    updated = 0
    async for g in ChatGroup.find_all():
        if g.company_id is not None:
            continue
        if g.created_by:
            creator = await User.get(PydanticObjectId(g.created_by))
            if creator and creator.company_id:
                g.company_id = creator.company_id
                await g.save()
                updated += 1
    return updated


async def backfill_categories() -> int:
    """Categories: company_id missing → assign to the first active company as fallback.
    Better: since categories predate company_id, leave them in a 'global' bucket and
    fix query code to fall back to listing without company filter for legacy rows.
    For now, set them to a single sentinel by reading from any user that has created
    data in the same collection window — not possible. So we skip rather than guess."""
    return 0


async def main():
    await init_db()
    print("=== Backfilling company_id for tenant-scoped collections ===\n")

    print(f"  Users with company_id         : {await backfill_users()}")
    print(f"  Task via assigned_to          : {await backfill_via_user('assigned_to', Task, 'Task')}")
    print(f"  Attendance via user_id        : {await backfill_via_user('user_id', Attendance, 'Attendance')}")
    print(f"  Leave via user_id             : {await backfill_via_user('user_id', Leave, 'Leave')}")
    print(f"  LeaveBalance via user_id      : {await backfill_via_user('user_id', LeaveBalance, 'LeaveBalance')}")
    print(f"  SalaryStructure via user_id   : {await backfill_via_user('user_id', SalaryStructure, 'SalaryStructure')}")
    print(f"  Payroll via user_id           : {await backfill_via_user('user_id', Payroll, 'Payroll')}")
    print(f"  PayrollHistory via created_by : {await backfill_via_user('created_by', PayrollHistory, 'PayrollHistory')}")
    print(f"  PayrollImpact via user_id     : {await backfill_via_user('user_id', PayrollRecalculationImpact, 'PayrollImpact')}")
    print(f"  Regularization via user_id    : {await backfill_via_user('user_id', AttendanceRegularization, 'AttendanceRegularization')}")
    print(f"  ChatGroup via created_by      : {await backfill_chat_groups()}")
    print(f"  ChatMessage via sender_id     : {await backfill_via_sender('sender_id', ChatMessage)}")
    print(f"  Notification via user_id      : {await backfill_via_user('user_id', Notification, 'Notification')}")
    print(f"  NotificationPref via user_id  : {await backfill_via_user('user_id', NotificationPreference, 'NotificationPreference')}")
    print(f"  NotificationDeliveryLog       : {await backfill_via_user('user_id', NotificationDeliveryLog, 'NotificationDeliveryLog')}")
    print(f"  AuditEvent via actor_id       : {await backfill_via_user('actor_id', AuditEvent, 'AuditEvent')}")
    print(f"  ActivityLog via user_id       : {await backfill_via_user('user_id', ActivityLog, 'ActivityLog')}")
    print(f"  CachedAIInsight via user_id   : {await backfill_via_user('user_id', CachedAIInsight, 'CachedAIInsight')}")
    print(f"  LeaveLedger via user_id       : {await backfill_via_user('user_id', LeaveLedgerEntry, 'LeaveLedgerEntry')}")
    print(f"  RewardLedger via user_id      : {await backfill_via_user('user_id', RewardLedgerEntry, 'RewardLedgerEntry')}")
    print(f"  Category (skipped, no owner)  : {await backfill_categories()}")
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
