
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.attendance import Attendance, ist_now
from datetime import timedelta
from beanie import PydanticObjectId

@pytest.mark.asyncio
async def test_admin_dashboard_optimized(db):
    # Setup
    tenant = Tenant(name="Test Tenant")
    await tenant.insert()

    admin = User(
        name="Admin",
        email="admin@test.com",
        password_hash="hash",
        role=UserRole.ADMIN,
        tenant_id=tenant.id
    )
    await admin.insert()

    employee = User(
        name="Employee",
        email="emp@test.com",
        password_hash="hash",
        role=UserRole.EMPLOYEE,
        tenant_id=tenant.id,
        is_active=True
    )
    await employee.insert()

    # Today's attendance
    today_start = ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    await Attendance(
        user_id=employee.id,
        tenant_id=tenant.id,
        check_in=today_start + timedelta(hours=9),
        status="present"
    ).insert()

    # Mock auth
    from app.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: admin

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/dashboard/admin")

    assert response.status_code == 200
    data = response.json()

    # Verify employee stats
    assert data["employees"]["total"] == 1
    assert data["employees"]["active"] == 1
    assert data["employees"]["role_counts"]["employee"]["total"] == 1
    assert data["employees"]["role_counts"]["employee"]["present"] == 1

    # Verify attendance today
    assert data["attendance_today"]["present"] == 1
    assert data["attendance_today"]["total"] == 1

    app.dependency_overrides = {}
