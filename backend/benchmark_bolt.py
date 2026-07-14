
import asyncio
import time
import os
import sys

# MUST set this before any app imports to trigger in-memory fallback
os.environ["ALLOW_IN_MEMORY_DB_FALLBACK"] = "True"
os.environ["AUTO_SEED_DEFAULT_USERS"] = "False"

from datetime import datetime, timezone, timedelta

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Patch Beanie specifically for the benchmark environment
import beanie.odm.queries.aggregation
orig_get_cursor = beanie.odm.queries.aggregation.AggregationQuery.get_cursor
async def patched_get_cursor(self):
    # This patch fixes compatibility between Beanie and some mongomock_motor versions
    # ONLY for the benchmark/test environment.
    res = self.document_model.get_pymongo_collection().aggregate(
        self.aggregation_pipeline, session=self.session, **self.pymongo_kwargs
    )
    if asyncio.iscoroutine(res) or hasattr(res, "__await__"):
        try:
            return await res
        except TypeError:
            return res
    return res
# Note: In Beanie 2.x, get_cursor might be called as await self.get_cursor()
# depending on the context, but the reviewer says it is synchronous.
# Let's check Beanie version and behavior.
beanie.odm.queries.aggregation.AggregationQuery.get_cursor = patched_get_cursor

from app.database.connection import init_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.attendance import Attendance, IST
from app.models.tenant import Tenant
from app.models.company import Company
from app.models.activity_log import ActivityLog
from app.services.dashboard_service import get_admin_dashboard
from app.auth.password import hash_password
from beanie import PydanticObjectId

async def setup_benchmark_data(num_employees=100, num_tasks=500):
    print(f"Setting up benchmark data: {num_employees} employees, {num_tasks} tasks...")

    # Use raw collection for fast reset as per memory
    await User.get_pymongo_collection().delete_many({})
    await Task.get_pymongo_collection().delete_many({})
    await Attendance.get_pymongo_collection().delete_many({})
    await ActivityLog.get_pymongo_collection().delete_many({})
    await Tenant.get_pymongo_collection().delete_many({})
    await Company.get_pymongo_collection().delete_many({})

    # Create tenant
    tenant = Tenant(name="Benchmark Tenant", domain="benchmark.com")
    await tenant.insert()

    # Create company
    company = Company(name="Benchmark Co", tenant_id=tenant.id)
    await company.insert()

    # Create admin
    admin = User(
        name="Admin User",
        email="admin@benchmark.com",
        password_hash=hash_password("password"),
        role=UserRole.ADMIN,
        tenant_id=tenant.id,
        company_id=company.id
    )
    await admin.insert()

    # Create employees
    employees = []
    for i in range(num_employees):
        emp = User(
            name=f"Employee {i}",
            email=f"emp{i}@benchmark.com",
            password_hash=hash_password("password"),
            role=UserRole.EMPLOYEE,
            tenant_id=tenant.id,
            company_id=company.id,
            is_active=True
        )
        employees.append(emp)

    if employees:
        await User.insert_many(employees)

    all_employees = await User.find(User.role == UserRole.EMPLOYEE).to_list()
    employee_ids = [e.id for e in all_employees]

    # Create attendance for 50% of employees
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    attendances = []
    for i in range(num_employees // 2):
        att = Attendance(
            user_id=employee_ids[i],
            tenant_id=tenant.id,
            check_in=today_start + timedelta(hours=9)
        )
        attendances.append(att)

    if attendances:
        await Attendance.insert_many(attendances)

    # Create tasks
    tasks = []
    statuses = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.OVERDUE]
    priorities = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.REGULAR]
    for i in range(num_tasks):
        task = Task(
            work_description=f"Task {i}",
            assigned_to=employee_ids[i % num_employees],
            created_by=admin.id,
            status=statuses[i % len(statuses)],
            priority=priorities[i % len(priorities)],
            deadline=now + (timedelta(days=1) if i % 2 == 0 else timedelta(days=-1)),
            tenant_id=tenant.id,
            reward_given=(i % 5 == 0)
        )
        tasks.append(task)

    if tasks:
        await Task.insert_many(tasks)

    # Create activity logs
    logs = []
    for i in range(20):
        log = ActivityLog(
            user_id=employee_ids[i % num_employees],
            action="test_action",
            details=f"Activity {i}",
            tenant_id=tenant.id
        )
        logs.append(log)

    if logs:
        await ActivityLog.insert_many(logs)

    return admin

async def run_benchmark():
    await init_db()
    admin = await setup_benchmark_data(num_employees=200, num_tasks=1000)

    print("\nStarting benchmark for get_admin_dashboard...")

    iterations = 5
    latencies = []

    for i in range(iterations):
        start_time = time.time()
        await get_admin_dashboard(admin)
        end_time = time.time()
        latency = end_time - start_time
        latencies.append(latency)
        print(f"Iteration {i+1}: {latency:.4f}s")

    avg_latency = sum(latencies) / iterations
    print(f"\nAverage Latency: {avg_latency:.4f}s")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
