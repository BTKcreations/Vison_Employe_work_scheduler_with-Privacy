import asyncio
import time
import os
import random
from datetime import datetime, timedelta, timezone
from beanie import init_beanie, PydanticObjectId
from pymongo import AsyncMongoClient
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus, TaskPriority, TaskType
from app.models.attendance import Attendance
from app.models.activity_log import ActivityLog
from app.models.tenant import Tenant
from app.models.business_unit import BusinessUnit
from app.services.dashboard_service import get_admin_dashboard

# Use a dedicated benchmark database
DB_NAME = "benchmark_dashboard_db"

async def seed_data(num_users=200, num_tasks=1000):
    print(f"Seeding {num_users} users and {num_tasks} tasks...")

    tenant = Tenant(name="Benchmark Tenant")
    await tenant.insert()

    admin = User(
        name="Admin User",
        email="admin_bench@example.com",
        password_hash="fake_hash",
        role=UserRole.ADMIN,
        tenant_id=tenant.id
    )
    await admin.insert()

    users = []
    roles = [UserRole.MANAGER, UserRole.ASSISTANT_MANAGER, UserRole.EMPLOYEE]
    for i in range(num_users):
        user = User(
            name=f"User {i}",
            email=f"user{i}@example.com",
            password_hash="fake_hash",
            role=random.choice(roles),
            tenant_id=tenant.id
        )
        users.append(user)

    if users:
        await User.insert_many(users)

    # Reload users to get IDs
    db_users = await User.find(User.role != UserRole.ADMIN).to_list()
    user_ids = [u.id for u in db_users]

    tasks = []
    now = datetime.now(timezone.utc)
    for i in range(num_tasks):
        assignee_id = random.choice(user_ids)
        task = Task(
            work_description=f"Task description {i}",
            assigned_to=assignee_id,
            created_by=admin.id,
            status=random.choice(list(TaskStatus)),
            priority=random.choice(list(TaskPriority)),
            deadline=now + timedelta(days=random.randint(-5, 5)),
            tenant_id=tenant.id,
            reward_given=random.choice([True, False])
        )
        tasks.append(task)

    if tasks:
        await Task.insert_many(tasks)

    # Seed some attendance for today
    attendance_records = []
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(int(num_users * 0.7)): # 70% present
        att = Attendance(
            user_id=user_ids[i],
            tenant_id=tenant.id,
            check_in=today_start + timedelta(hours=9)
        )
        attendance_records.append(att)

    if attendance_records:
        await Attendance.insert_many(attendance_records)

    print("Seeding complete.")
    return admin

async def run_benchmark(admin_user):
    print("Starting benchmark...")
    num_runs = 5
    latencies = []

    for i in range(num_runs):
        start_time = time.perf_counter()
        # We pass None for visible_ids to let it calculate hierarchy
        await get_admin_dashboard(admin_user)
        end_time = time.perf_counter()

        latency = end_time - start_time
        latencies.append(latency)
        print(f"Run {i+1}: {latency:.4f}s")

    avg_latency = sum(latencies) / num_runs
    print(f"\nAverage Latency: {avg_latency:.4f}s")
    return avg_latency

async def main():
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        print("Error: MONGODB_URL environment variable not set.")
        return

    client = AsyncMongoClient(mongodb_url)
    # Ensure we use a clean database for benchmarking
    await client.drop_database(DB_NAME)

    await init_beanie(
        database=client[DB_NAME],
        document_models=[User, Task, Attendance, ActivityLog, Tenant, BusinessUnit]
    )

    try:
        admin_user = await seed_data()
        await run_benchmark(admin_user)
    finally:
        # Clean up
        await client.drop_database(DB_NAME)

if __name__ == "__main__":
    asyncio.run(main())
