
import asyncio
import time
import os
from pymongo import AsyncMongoClient
from beanie import init_beanie, PydanticObjectId
from app.config import settings
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.attendance import Attendance
from app.models.activity_log import ActivityLog
from app.models.tenant import Tenant
from app.models.company import Company
from app.models.holiday import Holiday
from app.models.leave import Leave
from app.models.leave_balance import LeaveBalance
from app.models.payroll import Payroll, SalaryStructure, PayrollHistory
from app.models.regularization import AttendanceRegularization
from app.models.notification import Notification
from app.models.recurring_task import RecurrenceRule
from app.models.category import Category
from app.models.business_unit import BusinessUnit
from app.models.payroll_impact import PayrollRecalculationImpact
from app.services.dashboard_service import get_admin_dashboard
from datetime import datetime, timedelta, timezone

async def setup_benchmark_data(n_users=100, n_tasks=500):
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    actual_models = [
        User, PayrollRecalculationImpact, Leave, LeaveBalance,
        Payroll, PayrollHistory, AttendanceRegularization, Attendance, Company,
        Holiday, Task, Notification, ActivityLog, Category, RecurrenceRule,
        SalaryStructure, BusinessUnit, Tenant
    ]

    await init_beanie(database=db, document_models=actual_models)

    # Clear existing data for benchmark consistency
    await User.get_pymongo_collection().delete_many({})
    await Task.get_pymongo_collection().delete_many({})
    await Attendance.get_pymongo_collection().delete_many({})
    await ActivityLog.get_pymongo_collection().delete_many({})

    # Create Admin
    admin = User(
        name="Benchmark Admin",
        email="admin@bench.com",
        password_hash="fake_hash",
        role=UserRole.ADMIN,
        is_active=True
    )
    await admin.insert()

    # Create Employees
    users = []
    for i in range(n_users):
        user = User(
            name=f"Employee {i}",
            email=f"emp{i}@bench.com",
            password_hash="fake_hash",
            role=UserRole.EMPLOYEE,
            is_active=True,
            tenant_id=admin.tenant_id
        )
        await user.insert()
        users.append(user)

    # Create Tasks
    now = datetime.now(timezone.utc)
    for i in range(n_tasks):
        assigned_to = users[i % n_users]
        task = Task(
            work_description=f"Task {i}",
            assigned_to=assigned_to.id,
            created_by=admin.id,
            status=TaskStatus.PENDING if i % 2 == 0 else TaskStatus.COMPLETED,
            priority=TaskPriority.HIGH if i % 3 == 0 else TaskPriority.REGULAR,
            deadline=now + timedelta(days=1 if i % 2 == 0 else -1),
            completed_at=now - timedelta(hours=2) if i % 2 != 0 else None,
            tenant_id=admin.tenant_id
        )
        await task.insert()

    # Create Attendance for today
    for user in users[:n_users // 2]:
        att = Attendance(
            user_id=user.id,
            check_in=datetime.now(timezone.utc).replace(hour=9, minute=0),
            tenant_id=admin.tenant_id
        )
        await att.insert()

    return admin

async def run_benchmark(admin, iterations=5):
    print(f"Running benchmark for get_admin_dashboard ({iterations} iterations)...")
    durations = []
    for i in range(iterations):
        start_time = time.time()
        await get_admin_dashboard(admin)
        end_time = time.time()
        durations.append(end_time - start_time)
        print(f"Iteration {i+1}: {end_time - start_time:.4f}s")

    avg_duration = sum(durations) / iterations
    print(f"\nAverage Duration: {avg_duration:.4f}s")
    return avg_duration

async def main():
    admin = await setup_benchmark_data(n_users=100, n_tasks=500)
    await run_benchmark(admin)

if __name__ == "__main__":
    asyncio.run(main())
