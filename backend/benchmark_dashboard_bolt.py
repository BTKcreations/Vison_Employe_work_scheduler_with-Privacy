
import asyncio
import os
import time
from datetime import datetime, timezone, timedelta
from beanie import init_beanie, PydanticObjectId
from pymongo import AsyncMongoClient
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.attendance import Attendance, IST, ist_now
from app.models.tenant import Tenant
from app.models.activity_log import ActivityLog
from app.models.company import Company
from app.models.business_unit import BusinessUnit
from app.services.dashboard_service import get_admin_dashboard

async def seed_data(count=100):
    print(f"Seeding {count} employees and related data...")
    tenant = Tenant(name="Benchmark Tenant")
    await tenant.insert()

    company = Company(name="Benchmark Company", tenant_id=tenant.id)
    await company.insert()

    bu = BusinessUnit(name="Benchmark BU", tenant_id=tenant.id, company_id=company.id)
    await bu.insert()

    admin = User(
        name="Admin",
        email=f"admin_{int(time.time())}@example.com",
        password_hash="hash",
        role=UserRole.ADMIN,
        tenant_id=tenant.id,
        business_unit_id=bu.id
    )
    await admin.insert()

    employees = []
    for i in range(count):
        emp = User(
            name=f"Employee {i}",
            email=f"emp_{i}_{int(time.time())}@example.com",
            password_hash="hash",
            role=UserRole.EMPLOYEE,
            tenant_id=tenant.id,
            business_unit_id=bu.id,
            is_active=(i % 10 != 0) # 10% inactive
        )
        await emp.insert()
        employees.append(emp)

    # Seed attendance for today (50% present)
    today_start = ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(0, count, 2):
        att = Attendance(
            user_id=employees[i].id,
            tenant_id=tenant.id,
            business_unit_id=bu.id,
            check_in=today_start + timedelta(hours=9)
        )
        await att.insert()

    # Seed tasks (5 per employee)
    for emp in employees:
        for i in range(5):
            task = Task(
                work_description=f"Task {i} for {emp.name}",
                assigned_to=emp.id,
                created_by=admin.id,
                status=TaskStatus.PENDING if i % 2 == 0 else TaskStatus.COMPLETED,
                priority=TaskPriority.HIGH if i % 3 == 0 else TaskPriority.REGULAR,
                deadline=datetime.now(timezone.utc) + timedelta(days=1 if i % 2 == 0 else -1),
                tenant_id=tenant.id,
                business_unit_id=bu.id,
                reward_given=(i % 4 == 0)
            )
            await task.insert()

    return admin, tenant, bu

async def run_benchmark():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncMongoClient(mongodb_url)
    db_name = "benchmark_db_" + str(int(time.time()))
    db = client[db_name]

    # We need to import all models to init_beanie
    from app.models.user import User
    from app.models.task import Task
    from app.models.activity_log import ActivityLog
    from app.models.tenant import Tenant
    from app.models.attendance import Attendance
    from app.models.company import Company
    from app.models.business_unit import BusinessUnit
    from app.models.holiday import Holiday
    from app.models.recurring_task import RecurrenceRule
    from app.models.notification import Notification
    from app.models.category import Category
    from app.models.leave import Leave
    from app.models.leave_balance import LeaveBalance
    from app.models.regularization import AttendanceRegularization
    from app.models.payroll import Payroll, SalaryStructure, PayrollHistory
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

    models = [
        User, Task, ActivityLog, Tenant, Company, Attendance, Holiday,
        RecurrenceRule, Notification, Category, Leave, LeaveBalance,
        AttendanceRegularization, SalaryStructure, Payroll, PayrollHistory,
        ChatGroup, ChatMessage, CachedAIInsight, AuditEvent, PayrollRecalculationImpact,
        PolicyVersion, ApprovalPolicy, Employee, LeaveLedgerEntry, RewardLedgerEntry,
        NotificationTemplate, NotificationPreference, NotificationDeliveryLog,
        BusinessUnit, SubscriptionPlan, PlatformAuditLog
    ]

    await init_beanie(database=db, document_models=models)

    admin, tenant, bu = await seed_data(200) # Seed 200 employees

    print("\nStarting benchmark...")
    iterations = 5
    start_time = time.perf_counter()
    for i in range(iterations):
        iter_start = time.perf_counter()
        await get_admin_dashboard(admin)
        iter_end = time.perf_counter()
        print(f"Iteration {i+1}: {iter_end - iter_start:.4f}s")

    end_time = time.perf_counter()
    avg_time = (end_time - start_time) / iterations
    print(f"\nAverage time for get_admin_dashboard: {avg_time:.4f}s")

    # Cleanup
    await client.drop_database(db_name)

if __name__ == "__main__":
    asyncio.run(run_benchmark())
