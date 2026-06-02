import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User, UserRole
from app.models.leave import Leave, LeaveType, LeaveStatus
from app.models.leave_balance import LeaveBalance
from app.models.payroll import Payroll, PayrollStatus, SalaryStructure
from app.models.attendance import Attendance, IST
from app.models.company import Company
from app.models.task import Task
from app.models.payroll_impact import PayrollRecalculationImpact
from datetime import datetime, timedelta, timezone
from beanie import PydanticObjectId


@pytest_asyncio.fixture(autouse=True)
async def db():
    import os
    from beanie import init_beanie
    from pymongo import AsyncMongoClient
    from app.models.user import User
    from app.models.company import Company
    from app.models.attendance import Attendance
    from app.models.leave import Leave
    from app.models.leave_balance import LeaveBalance
    from app.models.payroll import Payroll, SalaryStructure, PayrollHistory
    from app.models.task import Task
    from app.models.notification import Notification
    from app.models.audit_event import AuditEvent
    from app.models.payroll_impact import PayrollRecalculationImpact
    from app.models.regularization import AttendanceRegularization
    from app.models.category import Category
    from app.models.holiday import Holiday
    from app.models.activity_log import ActivityLog
    from app.models.chat_group import ChatGroup
    from app.models.chat_message import ChatMessage
    from app.models.ai_insight import CachedAIInsight
    from app.models.recurring_task import RecurrenceRule
    from app.models.employee import Employee

    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncMongoClient(mongodb_url)
    await init_beanie(
        database=client.test_db_workflows,
        document_models=[
            User,
            Company,
            Attendance,
            Leave,
            LeaveBalance,
            Payroll,
            SalaryStructure,
            PayrollHistory,
            Task,
            Notification,
            AuditEvent,
            PayrollRecalculationImpact,
            AttendanceRegularization,
            Category,
            Holiday,
            ActivityLog,
            ChatGroup,
            ChatMessage,
            CachedAIInsight,
            RecurrenceRule,
            Employee,
        ],
    )

    # Clear db
    models = [
        User,
        Company,
        Attendance,
        Leave,
        LeaveBalance,
        Payroll,
        SalaryStructure,
        PayrollHistory,
        Task,
        Notification,
        AuditEvent,
        PayrollRecalculationImpact,
        AttendanceRegularization,
        Category,
        Holiday,
        ActivityLog,
        ChatGroup,
        ChatMessage,
        CachedAIInsight,
        RecurrenceRule,
        Employee,
    ]
    for model in models:
        await model.find_all().delete()

    yield
    await client.drop_database("test_db_workflows")


@pytest_asyncio.fixture
async def setup_data(db):
    company = Company(name="Workflow Corp", office_lat=12.9716, office_lng=77.5946)
    await company.insert()

    admin = User(
        email="admin@workflow.com",
        name="Admin",
        password_hash="hash",
        role=UserRole.ADMIN,
        company_id=company.id,
    )
    await admin.insert()

    manager = User(
        email="manager@workflow.com",
        name="Manager",
        password_hash="hash",
        role=UserRole.MANAGER,
        company_id=company.id,
    )
    await manager.insert()

    assistant_manager = User(
        email="am@workflow.com",
        name="Asst Manager",
        password_hash="hash",
        role=UserRole.ASSISTANT_MANAGER,
        company_id=company.id,
        reporting_manager_id=manager.id,
    )
    await assistant_manager.insert()

    assistant_hr = User(
        email="ahr@workflow.com",
        name="Asst HR",
        password_hash="hash",
        role=UserRole.ASSISTANT_HR_MANAGER,
        company_id=company.id,
    )
    await assistant_hr.insert()

    employee = User(
        email="emp@workflow.com",
        name="Employee",
        password_hash="hash",
        role=UserRole.EMPLOYEE,
        company_id=company.id,
        reporting_manager_id=assistant_manager.id,
        hr_reporting_manager_id=assistant_hr.id,
    )
    await employee.insert()

    # Salary Structure
    ss = SalaryStructure(
        user_id=employee.id, basic=50000, hra=20000, special_allowance=10000
    )
    await ss.insert()

    # Leave Balance
    lb = LeaveBalance(
        user_id=employee.id, casual_allocated=12, sick_allocated=10, earned_allocated=15
    )
    await lb.insert()

    return {
        "company": company,
        "admin": admin,
        "manager": manager,
        "am": assistant_manager,
        "ahr": assistant_hr,
        "employee": employee,
    }


@pytest.mark.asyncio
async def test_onboarding_to_task_workflow(setup_data):
    """Admin creates employee, then AM assigns task to them."""
    data = setup_data
    from app.auth.dependencies import get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Admin creates employee (already in setup_data, but let's simulate another)
        app.dependency_overrides[get_current_user] = lambda: data["admin"]
        payload = {
            "email": "newbie@workflow.com",
            "name": "Newbie",
            "password": "Password123",
            "mobile": "1234567890",
            "role": "employee",
            "reporting_manager_id": str(data["am"].id),
            "hr_reporting_manager_id": str(data["ahr"].id),
        }
        res = await ac.post("/admin/employees", json=payload)
        assert res.status_code == 201
        new_emp_id = res.json()["id"]

        # 2. AM assigns task to Newbie
        app.dependency_overrides[get_current_user] = lambda: data["am"]
        task_payload = {
            "work_description": "Welcome Task",
            "assigned_to": new_emp_id,
            "priority": "medium",
            "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        }
        res = await ac.post("/tasks", json=task_payload)
        assert res.status_code == 201
        assert res.json()["assigned_to"] == new_emp_id


@pytest.mark.asyncio
async def test_leave_to_payroll_workflow(setup_data):
    """Employee applies for leave, Admin approves, check balance & payroll impact."""
    data = setup_data
    emp = data["employee"]
    from app.auth.dependencies import get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Employee applies for leave
        app.dependency_overrides[get_current_user] = lambda: emp
        leave_payload = {
            "leave_type": "casual",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": datetime.now(timezone.utc).isoformat(),
            "reason": "Personal work",
        }
        res = await ac.post("/leaves/apply", json=leave_payload)
        assert res.status_code == 201
        leave_id = res.json()["leave_id"]

        # 2. Admin approves leave
        app.dependency_overrides[get_current_user] = lambda: data["admin"]
        res = await ac.post(f"/leaves/approve/{leave_id}", json={"comments": "Enjoy"})
        assert res.status_code == 200

        # 3. Verify balance deducted
        balance = await LeaveBalance.find_one(LeaveBalance.user_id == emp.id)
        assert balance.casual_used == 1

        # 4. Verify Attendance marked
        attendance = await Attendance.find_one(Attendance.user_id == emp.id)
        assert attendance is not None
        assert attendance.status == "present"

        # 5. Verify Payroll Impact
        impact = await PayrollRecalculationImpact.find_one(
            PayrollRecalculationImpact.user_id == emp.id
        )
        assert impact is not None
        assert impact.source_event_type == "leave_approval"


@pytest.mark.asyncio
async def test_payroll_lock_workflow(setup_data):
    """Payroll locked should block mutation and flag recalculation."""
    data = setup_data
    emp = data["employee"]
    from app.auth.dependencies import get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Create a locked payroll
        month_str = datetime.now(IST).strftime("%Y-%m")
        payroll = Payroll(
            user_id=emp.id,
            user_name=emp.name,
            month=month_str,
            status=PayrollStatus.LOCKED,
            net_salary=50000,
        )
        await payroll.insert()

        # 2. Try to recalculate locked payroll (should fail without force, but our route uses force=True for manual)
        # Actually calculate_corporate_payroll has 'if existing and existing.status in [LOCKED, PAID] and not force: return existing'
        # manual_recalculate_payroll route calls it with force=True.
        # But automatic ones (like leave approval) should NOT overwrite if locked.

        # Simulate leave approval for locked month
        leave = Leave(
            user_id=emp.id,
            user_name=emp.name,
            leave_type=LeaveType.SICK,
            start_date=datetime.now(timezone.utc),
            end_date=datetime.now(timezone.utc),
            reason="Sick",
            status=LeaveStatus.PENDING,
        )
        await leave.insert()

        app.dependency_overrides[get_current_user] = lambda: data["admin"]
        res = await ac.post(f"/leaves/approve/{leave.id}", json={"comments": "ok"})
        assert res.status_code == 200

        # 3. Verify payroll still locked but flagged for recalculation
        updated_payroll = await Payroll.get(payroll.id)
        assert updated_payroll.status == PayrollStatus.LOCKED
        assert updated_payroll.recalculation_required == True
