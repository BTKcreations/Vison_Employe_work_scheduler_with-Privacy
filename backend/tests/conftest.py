import os
import pytest
from httpx import AsyncClient, ASGITransport

# Force database name and JWT secret for testing
os.environ["DATABASE_NAME"] = "employee_task_test"
os.environ["JWT_SECRET"] = "test-jwt-secret-key-for-vision-work-scheduler-123456789"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"

from app.database.connection import init_db
from app.main import app
from app.models.user import User
from app.models.task import Task
from app.models.company import Company
from app.models.attendance import Attendance
from app.models.holiday import Holiday
from app.models.recurring_task import RecurrenceRule
from app.models.notification import Notification
from app.models.category import Category
from app.models.system_settings import SystemSettings
from app.models.activity_log import ActivityLog
from app.models.leave import Leave
from app.models.role import CompanyRole

@pytest.fixture(autouse=True)
async def init_and_clean_db():
    """Initialize Beanie ODM and clean all collections for each function test's event loop."""
    await init_db()
    
    models = [User, Task, Company, Attendance, Holiday, RecurrenceRule, Notification, Category, SystemSettings, ActivityLog, Leave, CompanyRole]
    for model in models:
        try:
            await model.delete_all()
        except Exception as e:
            print(f"Error cleaning {model.__name__}: {e}")
    
    from app.models.role import seed_default_roles
    await seed_default_roles()
    yield

@pytest.fixture
async def client():
    """Yield an async TestClient using httpx and ASGITransport."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver"
    ) as ac:
        yield ac
