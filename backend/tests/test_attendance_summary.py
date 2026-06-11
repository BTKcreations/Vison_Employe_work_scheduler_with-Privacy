import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User, UserRole
from app.models.attendance import Attendance
from app.models.tenant import Tenant
from beanie import PydanticObjectId
from datetime import datetime, timedelta, timezone

@pytest_asyncio.fixture
async def test_company(db):
    company = Tenant(
        name="Summary Test Corp",
        geofence_radius_meters=1000
    )
    await company.insert()
    return company

@pytest_asyncio.fixture
async def test_admin(db, test_company):
    admin = User(
        email="test_admin_summary@company.com",
        name="Test Admin",
        password_hash="fakehash",
        role=UserRole.ADMIN,
        tenant_id=test_company.id
    )
    await admin.insert()
    return admin

@pytest.mark.asyncio
async def test_get_attendance_summary_optimized(test_admin, test_company, db):
    """Test the optimized attendance summary route."""
    from app.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: test_admin

    # Create a test employee
    employee = User(
        name="Summary Employee",
        email="summary_emp@test.com",
        password_hash="fake",
        role=UserRole.EMPLOYEE,
        tenant_id=test_company.id,
        is_active=True
    )
    await employee.insert()

    # Create attendance for today
    now = datetime.now(timezone.utc)
    att = Attendance(
        user_id=employee.id,
        tenant_id=test_company.id,
        check_in=now,
        status="present"
    )
    await att.insert()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/attendance/summary")
        assert response.status_code == 200
        data = response.json()

        # Verify employee is in summary
        emp_summary = next((s for s in data if s["user_id"] == str(employee.id)), None)
        assert emp_summary is not None
        assert emp_summary["user_name"] == employee.name

        # Verify today's status is present
        # Note: history is now built in 5-days-ago -> today order
        today_history = emp_summary["history"][-1]
        assert today_history["status"] == "present"

    app.dependency_overrides.clear()
