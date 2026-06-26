import asyncio
import os
import time
import random
from datetime import datetime, timedelta, timezone
import mongomock
from mongomock_motor import AsyncMongoMockClient
from beanie import init_beanie, PydanticObjectId
from app.models.user import User, UserRole
from app.models.attendance import Attendance, IST
from app.models.company import Company
from app.models.tenant import Tenant
from app.models.audit_event import AuditEvent
from app.models.payroll import Payroll, PayrollHistory, SalaryStructure
from app.models.payroll_impact import PayrollRecalculationImpact
from app.models.leave import Leave
from app.models.leave_balance import LeaveBalance
from app.models.regularization import AttendanceRegularization
from app.models.holiday import Holiday
from app.models.task import Task
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.category import Category
from app.models.recurring_task import RecurrenceRule
from app.services.dashboard_service import get_all_attendance_summary

# Monkeypatch mongomock to handle Beanie's extra kwargs
original_list_collection_names = mongomock.Database.list_collection_names
def patched_list_collection_names(self, filter=None, **kwargs):
    return original_list_collection_names(self, filter=filter)
mongomock.Database.list_collection_names = patched_list_collection_names

async def setup_benchmark_data(num_employees=100):
    client = AsyncMongoMockClient()
    db = client["benchmark_db"]

    models = [User, Company, Attendance, Tenant, AuditEvent, PayrollRecalculationImpact, Leave, LeaveBalance, Payroll, PayrollHistory, SalaryStructure, AttendanceRegularization, Holiday, Task, Notification, ActivityLog, Category, RecurrenceRule]

    await init_beanie(database=db, document_models=models)

    tenant = Tenant(name="Benchmark Tenant")
    await tenant.insert()

    company = Company(name="Benchmark Company", tenant_id=tenant.id)
    await company.insert()

    employees = []
    for i in range(num_employees):
        emp = User(
            name=f"Employee {i}",
            email=f"emp{i}@example.com",
            password_hash="hash",
            role=UserRole.EMPLOYEE,
            tenant_id=tenant.id,
            is_active=True,
            is_deleted=False,
            reward_points=random.randint(0, 1000)
        )
        employees.append(emp)

    await User.insert_many(employees)

    # Re-fetch to get IDs
    employees = await User.find(User.tenant_id == tenant.id).to_list()

    today = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
    attendance_records = []
    for emp in employees:
        # Give each employee attendance for exactly the last 2 days for verification
        for i in range(2):
            day = today - timedelta(days=i)
            check_in = day + timedelta(hours=9) # 9 AM IST
            # Attendance model expects UTC in DB usually, but Beanie/Pydantic handles it.
            # In raw PyMongo, we should store UTC.
            check_in_utc = check_in.astimezone(timezone.utc)
            check_out_utc = check_in_utc + timedelta(hours=8)
            att = Attendance(
                user_id=emp.id,
                tenant_id=tenant.id,
                check_in=check_in_utc,
                check_out=check_out_utc,
                location_in={"lat": 12.9716, "lng": 77.5946},
                address_in="Benchmark Address"
            )
            attendance_records.append(att)

    if attendance_records:
        await Attendance.insert_many(attendance_records)

    return tenant.id

async def verify_correctness(tenant_id):
    print("Verifying correctness...")
    summary = await get_all_attendance_summary(tenant_id=tenant_id)

    if not summary:
        print("Error: No summary returned")
        return False

    present_count = 0
    for emp_summary in summary:
        for entry in emp_summary["history"]:
            if entry["status"] == "present":
                present_count += 1

    print(f"Total present entries found: {present_count}")
    expected_present = 100 * 2 # 100 employees * 2 days
    if present_count == expected_present:
        print("Correctness verified!")
        return True
    else:
        print(f"Error: Expected {expected_present} present entries, but found {present_count}")
        # Print one entry for debugging
        print(f"Sample entry: {summary[0]['history'][-1]}")
        return False

async def main():
    tenant_id = await setup_benchmark_data(num_employees=100)
    if await verify_correctness(tenant_id):
        await run_benchmark(tenant_id, iterations=10)

async def run_benchmark(tenant_id, iterations=5):
    print(f"Running benchmark with {iterations} iterations...")
    start_time = time.time()
    for _ in range(iterations):
        await get_all_attendance_summary(tenant_id=tenant_id)
    end_time = time.time()
    avg_time = (end_time - start_time) / iterations
    print(f"Average execution time: {avg_time:.4f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
