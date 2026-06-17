
import time
import pytest
from app.models.user import User, UserRole
from app.models.attendance import Attendance
from app.services.dashboard_service import get_all_attendance_summary
from beanie import PydanticObjectId
from datetime import datetime, timedelta, timezone

@pytest.mark.asyncio
async def test_benchmark_attendance_summary(db):
    tenant_id = PydanticObjectId()

    # Create 1000 employees
    employees = []
    for i in range(1000):
        emp = User(
            name=f"Employee {i}",
            email=f"emp{i}@example.com",
            password_hash="hash",
            role=UserRole.EMPLOYEE,
            tenant_id=tenant_id,
            is_active=True
        )
        employees.append(emp)
    await User.insert_many(employees)

    # Create some attendance records (last 5 days)
    attendance_records = []
    today = datetime.now(timezone.utc)
    for i, emp in enumerate(employees):
        for d in range(5):
            if (i + d) % 3 != 0: # some missing records
                record = Attendance(
                    user_id=emp.id,
                    tenant_id=tenant_id,
                    check_in=today - timedelta(days=d),
                    check_out=today - timedelta(days=d) + timedelta(hours=8),
                    status="present"
                )
                attendance_records.append(record)
    await Attendance.insert_many(attendance_records)

    # Benchmark
    start_time = time.time()
    for _ in range(3):
        await get_all_attendance_summary(tenant_id=tenant_id)
    end_time = time.time()

    avg_time = (end_time - start_time) / 3
    print(f"\nAverage execution time for 1000 employees (Post-Optimization): {avg_time:.4f}s")
