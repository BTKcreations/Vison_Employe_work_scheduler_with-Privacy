import asyncio
import time
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from pymongo import AsyncMongoClient
from beanie import init_beanie, PydanticObjectId
from app.models.user import User, UserRole
from app.models.task import Task
from app.models.activity_log import ActivityLog
from app.models.tenant import Tenant
from app.models.company import Company
from app.models.attendance import Attendance
from app.models.holiday import Holiday
from app.models.recurring_task import RecurrenceRule
from app.models.notification import Notification
from app.models.category import Category
from app.models.leave import Leave
from app.models.leave_balance import LeaveBalance
from app.models.regularization import AttendanceRegularization
from app.models.payroll import SalaryStructure, Payroll, PayrollHistory
from app.models.chat_group import ChatGroup
from app.models.chat_message import ChatMessage
from app.models.ai_insight import CachedAIInsight
from app.models.audit_event import AuditEvent
from app.models.payroll_impact import PayrollRecalculationImpact
from app.models.policy import PolicyVersion, ApprovalPolicy
from app.models.employee import Employee
from app.models.ledger import LeaveLedgerEntry, RewardLedgerEntry
from app.models.notification_engine import NotificationTemplate, NotificationPreference, NotificationDeliveryLog
from app.models.subscription_plan import SubscriptionPlan
from app.models.platform_audit_log import PlatformAuditLog
from app.models.business_unit import BusinessUnit
from app.services.dashboard_service import get_admin_dashboard

async def run_benchmark():
    # Setup
    mongodb_url = os.environ.get("MONGODB_URL")
    if not mongodb_url:
        print("MONGODB_URL not set")
        return

    client = AsyncMongoClient(mongodb_url)
    db_name = os.environ.get("DATABASE_NAME", "employee_task_reward3")
    db = client[db_name]

    await init_beanie(
        database=db,
        document_models=[
            User, Task, ActivityLog, Tenant, Company, Attendance, Holiday,
            RecurrenceRule, Notification, Category, Leave, LeaveBalance,
            AttendanceRegularization, SalaryStructure, Payroll, PayrollHistory,
            ChatGroup, ChatMessage, CachedAIInsight, AuditEvent, PayrollRecalculationImpact,
            PolicyVersion, ApprovalPolicy, Employee, LeaveLedgerEntry, RewardLedgerEntry,
            NotificationTemplate, NotificationPreference, NotificationDeliveryLog,
            SubscriptionPlan, PlatformAuditLog, BusinessUnit
        ]
    )

    # Find an admin user or management user
    admin = await User.find_one({"role": {"$in": ["admin", "hr_manager", "manager"]}})
    if not admin:
        print("No management user found")
        return

    print(f"Benchmarking get_admin_dashboard for user: {admin.email} (Role: {admin.role})")

    # Warm up
    await get_admin_dashboard(admin)

    start_time = time.time()
    iterations = 5
    for i in range(iterations):
        print(f"Iteration {i+1}...")
        await get_admin_dashboard(admin)
    end_time = time.time()

    avg_time = (end_time - start_time) / iterations
    print(f"Average execution time over {iterations} iterations: {avg_time:.4f} seconds")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
