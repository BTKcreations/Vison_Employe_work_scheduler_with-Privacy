import asyncio
import time
import os
import sys
from datetime import datetime, timezone, timedelta

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from beanie import init_beanie, PydanticObjectId
from pymongo import AsyncMongoClient
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.attendance import Attendance
from app.models.tenant import Tenant
from app.models.activity_log import ActivityLog
from app.models.business_unit import BusinessUnit
from app.models.company import Company
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

from app.services.dashboard_service import get_admin_dashboard
from app.config import settings

async def setup_benchmark_data(num_employees=200):
    tenant = Tenant(name="Benchmark Tenant", is_active=True)
    await tenant.insert()

    admin = User(
        name="Benchmark Admin",
        email=f"admin_bench_{int(time.time())}@test.com",
        password_hash="hash",
        role=UserRole.ADMIN,
        tenant_id=tenant.id,
        is_active=True
    )
    await admin.insert()

    employees = []
    for i in range(num_employees):
        emp = User(
            name=f"Employee {i}",
            email=f"emp_{i}_{int(time.time())}@test.com",
            password_hash="hash",
            role=UserRole.EMPLOYEE,
            tenant_id=tenant.id,
            is_active=True
        )
        employees.append(emp)

    if employees:
        await User.get_pymongo_collection().insert_many([e.model_dump() for e in employees])

    # Fetch them back to get IDs
    employees = await User.find(User.tenant_id == tenant.id, User.role == UserRole.EMPLOYEE).to_list()

    # Seed some attendance for today
    from app.models.attendance import ist_now
    today_start = ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    attendance_records = []
    for i in range(num_employees // 2): # 50% present
        att = Attendance(
            user_id=employees[i].id,
            tenant_id=tenant.id,
            check_in=today_start + timedelta(hours=9),
            status="present"
        )
        attendance_records.append(att)

    if attendance_records:
        await Attendance.get_pymongo_collection().insert_many([a.model_dump() for a in attendance_records])

    # Seed some tasks
    tasks = []
    for i in range(num_employees):
        task = Task(
            work_description=f"Task {i}",
            assigned_to=employees[i].id,
            created_by=admin.id,
            status=TaskStatus.PENDING,
            priority=TaskPriority.MEDIUM,
            deadline=today_start + timedelta(days=1),
            tenant_id=tenant.id
        )
        tasks.append(task)

    if tasks:
        await Task.get_pymongo_collection().insert_many([t.model_dump() for t in tasks])

    return admin, tenant

async def run_benchmark():
    # Use real Mongo but a benchmark DB
    mongodb_url = os.getenv("MONGODB_URL", settings.MONGODB_URL)
    client = AsyncMongoClient(mongodb_url, tz_aware=True)
    db_name = "benchmark_db_" + str(int(time.time()))
    database = client[db_name]

    print(f"Connecting to benchmark database: {db_name}")

    await init_beanie(
        database=database,
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

    print(f"Seeding benchmark data (200 employees)...")
    admin, tenant = await setup_benchmark_data(200)

    print(f"Running benchmark for get_admin_dashboard...")

    # Warm up
    await get_admin_dashboard(admin)

    start_time = time.perf_counter()
    iterations = 20
    for i in range(iterations):
        if i % 5 == 0:
            print(f"  Iteration {i}...")
        await get_admin_dashboard(admin)
    end_time = time.perf_counter()

    avg_time = (end_time - start_time) / iterations
    print(f"\n[BENCHMARK RESULT]")
    print(f"Average execution time over {iterations} iterations: {avg_time * 1000:.2f} ms")

    # Cleanup
    print(f"Cleaning up database {db_name}...")
    await client.drop_database(db_name)

if __name__ == "__main__":
    asyncio.run(run_benchmark())
