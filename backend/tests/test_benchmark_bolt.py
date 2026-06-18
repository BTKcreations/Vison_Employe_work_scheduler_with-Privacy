import pytest
import time
import asyncio
from datetime import timedelta
from app.models.user import User, UserRole
from app.models.attendance import Attendance, ist_now
from app.services.dashboard_service import get_all_attendance_summary
from beanie import PydanticObjectId

@pytest.mark.asyncio
async def test_benchmark_attendance_summary(db):
    # Setup: 200 employees, each with 5 days of attendance
    tenant_id = PydanticObjectId()
    bu_id = PydanticObjectId()

    print(f"\nSeeding data for benchmark...")
    users = []
    for i in range(200):
        user = User(
            name=f"Employee {i}",
            email=f"emp{i}@test.com",
            password_hash="fake",
            role=UserRole.EMPLOYEE,
            tenant_id=tenant_id,
            business_unit_id=bu_id,
            reward_points=float(i)
        )
        users.append(user)

    await User.insert_many(users)
    inserted_users = await User.find(User.tenant_id == tenant_id).to_list()
    user_ids = [u.id for u in inserted_users]

    today = ist_now().replace(hour=9, minute=0, second=0, microsecond=0)
    attendance_records = []
    for uid in user_ids:
        for d in range(5):
            check_in = today - timedelta(days=d)
            attendance_records.append(Attendance(
                user_id=uid,
                tenant_id=tenant_id,
                business_unit_id=bu_id,
                check_in=check_in,
                check_out=check_in + timedelta(hours=8),
                status="present",
                location_in={"lat": 0.0, "lng": 0.0},
                address_in="Test Address"
            ))

    await Attendance.insert_many(attendance_records)
    print(f"Seeding complete. 200 users, 1000 attendance records.")

    # Warm up
    await get_all_attendance_summary(tenant_id=tenant_id)

    # Measure
    start_time = time.perf_counter()
    iterations = 5
    for _ in range(iterations):
        await get_all_attendance_summary(tenant_id=tenant_id)
    end_time = time.perf_counter()

    avg_time = (end_time - start_time) / iterations
    print(f"\nAverage execution time for get_all_attendance_summary: {avg_time:.4f}s")

    # Measure with BU filter
    start_time = time.perf_counter()
    for _ in range(iterations):
        await get_all_attendance_summary(tenant_id=tenant_id, business_unit_id=bu_id)
    end_time = time.perf_counter()
    avg_time_bu = (end_time - start_time) / iterations
    print(f"Average execution time with BU filter: {avg_time_bu:.4f}s")

    assert avg_time < 2.0 # Sanity check
