import pytest
from httpx import AsyncClient
from app.models.user import User, UserRole
from app.models.system_settings import SystemSettings
from app.models.task import Task
from app.models.company import Company
from app.auth.password import hash_password
from datetime import datetime, timedelta

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test the basic health check endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_auth_and_registration(client: AsyncClient):
    """Test the registration and login routes."""
    # 1. Register a new Admin
    register_payload = {
        "name": "Admin Test",
        "email": "admin_test@example.com",
        "password": "testpassword123",
        "role": "admin"
    }
    response = await client.post("/auth/register", json=register_payload)
    assert response.status_code == 201
    assert response.json()["message"] == "User registered successfully"
    assert response.json()["user"]["email"] == "admin_test@example.com"

    # 2. Log in with new Admin credentials
    login_payload = {
        "email": "admin_test@example.com",
        "password": "testpassword123"
    }
    response = await client.post("/auth/login", json=login_payload)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_system_settings_rbac(client: AsyncClient):
    """Test dynamic settings endpoint access restrictions."""
    from app.models.company import Company

    company = Company(
        name="Test Company",
        work_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        work_start_time="09:30 AM",
        work_end_time="06:30 PM",
        cut_out_time="10:00 AM",
        owner_id=None
    )
    await company.insert()

    # Create an employee and an admin
    admin = User(
        name="Admin User",
        email="admin@example.com",
        password_hash=hash_password("adminpass123"),
        role=UserRole.ADMIN,
        company_id=company.id
    )
    await admin.insert()

    company.owner_id = admin.id
    await company.save()

    employee = User(
        name="Employee User",
        email="employee@example.com",
        password_hash=hash_password("employeepass123"),
        role=UserRole.EMPLOYEE,
        company_id=company.id
    )
    await employee.insert()

    # Create another company to test tenant isolation
    other_company = Company(
        name="Other Company",
        work_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        work_start_time="09:30 AM",
        work_end_time="06:30 PM",
        cut_out_time="10:00 AM"
    )
    await other_company.insert()

    # Log in as Employee
    login_emp = await client.post("/auth/login", json={"email": "employee@example.com", "password": "employeepass123"})
    emp_token = login_emp.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Log in as Admin
    login_adm = await client.post("/auth/login", json={"email": "admin@example.com", "password": "adminpass123"})
    adm_token = login_adm.json()["access_token"]
    adm_headers = {"Authorization": f"Bearer {adm_token}"}

    # 1. Get settings as Employee (should succeed for transparency)
    response = await client.get(f"/settings?company_id={company.id}", headers=emp_headers)
    assert response.status_code == 200

    # 2. Put settings as Employee (should fail with 403)
    update_payload = {
        "priority_points": {
            "critical": 12.0,
            "high": 6.0,
            "medium": 3.0,
            "regular": 1.0
        }
    }
    response = await client.put(f"/settings?company_id={company.id}", json=update_payload, headers=emp_headers)
    assert response.status_code == 403

    # 3. Put settings as Admin for own company (should succeed)
    response = await client.put(f"/settings?company_id={company.id}", json=update_payload, headers=adm_headers)
    assert response.status_code == 200
    assert response.json()["priority_points"]["critical"] == 12.0

    # 4. Put settings as Admin for other company (should fail with 403 - privacy isolation)
    response = await client.put(f"/settings?company_id={other_company.id}", json=update_payload, headers=adm_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_employee_base_salary_creation_and_update(client: AsyncClient):
    """Test setting and updating employee base salary."""
    # Create Admin
    admin = User(
        name="Admin Manager",
        email="manager@example.com",
        password_hash=hash_password("managerpass123"),
        role=UserRole.ADMIN
    )
    await admin.insert()

    # Login Admin
    login_adm = await client.post("/auth/login", json={"email": "manager@example.com", "password": "managerpass123"})
    adm_headers = {"Authorization": f"Bearer {login_adm.json()['access_token']}"}

    # Create Employee with specific base salary
    create_emp_payload = {
        "name": "Jane Worker",
        "email": "jane@example.com",
        "password": "janepassword123",
        "role": "employee",
        "mobile": "9876543210",
        "alternate_mobile": "9876543211",
        "base_salary": 45000.0
    }
    response = await client.post("/admin/employees", json=create_emp_payload, headers=adm_headers)
    assert response.status_code == 201
    assert response.json()["base_salary"] == 45000.0
    employee_id = response.json()["id"]

    # Update base salary via put
    update_payload = {
        "name": "Jane Worker Updated",
        "email": "jane@example.com",
        "is_active": True,
        "role": "employee",
        "base_salary": 52000.0
    }
    response = await client.put(f"/admin/employees/{employee_id}", json=update_payload, headers=adm_headers)
    assert response.status_code == 200
    assert response.json()["base_salary"] == 52000.0


@pytest.mark.asyncio
async def test_dynamic_task_reward_payouts(client: AsyncClient):
    """Test that points are awarded perfectly based on settings configurations."""
    # Initialize dynamic settings
    settings_doc = SystemSettings(
        singleton_id="default",
        priority_points={
            "critical": 10.0,
            "high": 5.0,
            "medium": 3.0,
            "regular": 1.0
        },
        complexity_multipliers={
            "low": 0.8,
            "medium": 1.0,
            "high": 1.5
        },
        delay_reductions={
            "0": 1.0,
            "1": 0.75,
            "2": 0.5,
            "3": 0.25,
            "4": 0.0
        },
        early_completion_bonus=1.1
    )
    # Ensure it's active in the DB
    await SystemSettings.find_one({"singleton_id": "default"}).delete()
    await settings_doc.insert()

    # Create Company, Admin and Employee
    company = Company(
        name="Test Company",
        code="TC01",
        address="123 Street",
        latitude=12.9716,
        longitude=77.5946
    )
    await company.insert()

    admin = User(
        name="Boss Admin",
        email="boss@example.com",
        password_hash=hash_password("bosspass123"),
        role=UserRole.ADMIN,
        company_id=company.id
    )
    await admin.insert()

    employee = User(
        name="Dev Employee",
        email="dev@example.com",
        password_hash=hash_password("devpass123"),
        role=UserRole.EMPLOYEE,
        company_id=company.id,
        reward_points=0.0
    )
    await employee.insert()

    # Create a critical task with high complexity assigned to employee
    task = Task(
        work_description="Fix production pipeline",
        assigned_to=employee.id,
        assigned_to_name=employee.name,
        created_by=admin.id,
        created_by_name=admin.name,
        priority="critical",
        complexity="high",
        deadline=datetime.utcnow() + timedelta(days=2),
        company_id=company.id,
        company_name=company.name,
        category_ids=[],
        category_names=[]
    )
    await task.insert()

    # Login Admin
    login_adm = await client.post("/auth/login", json={"email": "boss@example.com", "password": "bosspass123"})
    adm_headers = {"Authorization": f"Bearer {login_adm.json()['access_token']}"}

    # Complete it via PUT /tasks/{task_id} with quality multiplier
    task_complete_payload = {
        "status": "completed",
        "quality_multiplier": 1.3
    }
    
    response = await client.put(f"/tasks/{task.id}", json=task_complete_payload, headers=adm_headers)
    assert response.status_code == 200
    
    # Fetch updated Employee points
    updated_employee = await User.get(employee.id)
    # Expected points calculation:
    # base_points for critical: 10.0
    # complexity multiplier for high: 1.5
    # Since deadline is in 2 days (>= 24 hours), early bonus is applied: 1.1x
    # Quality multiplier: 1.3x
    # Total points: 10.0 * 1.5 * 1.1 * 1.3 = 15.0 * 1.1 * 1.3 = 16.5 * 1.3 = 21.45
    assert updated_employee.reward_points == 21.45


@pytest.mark.asyncio
async def test_roles_rbac_and_routing(client: AsyncClient):
    """Test dynamic RBAC and routing for Manager and Assistant Manager roles."""
    # Create Manager, Assistant Manager, and Employee
    manager = User(
        name="Sujeeth Manager",
        email="sujeeth@example.com",
        password_hash=hash_password("managerpass123"),
        role=UserRole.MANAGER
    )
    await manager.insert()

    assistant_manager = User(
        name="Mounika AM",
        email="mounika@example.com",
        password_hash=hash_password("ampass123"),
        role=UserRole.ASSISTANT_MANAGER,
        parent_id=manager.id
    )
    await assistant_manager.insert()

    employee = User(
        name="Standard Emp",
        email="emp@example.com",
        password_hash=hash_password("emppass123"),
        role=UserRole.EMPLOYEE,
        parent_id=assistant_manager.id
    )
    await employee.insert()

    # 1. Login Manager
    login_mgr = await client.post("/auth/login", json={"email": "sujeeth@example.com", "password": "managerpass123"})
    assert login_mgr.status_code == 200
    mgr_headers = {"Authorization": f"Bearer {login_mgr.json()['access_token']}"}

    # 2. Login Assistant Manager
    login_am = await client.post("/auth/login", json={"email": "mounika@example.com", "password": "ampass123"})
    assert login_am.status_code == 200
    am_headers = {"Authorization": f"Bearer {login_am.json()['access_token']}"}

    # 3. Login Employee
    login_emp = await client.post("/auth/login", json={"email": "emp@example.com", "password": "emppass123"})
    assert login_emp.status_code == 200
    emp_headers = {"Authorization": f"Bearer {login_emp.json()['access_token']}"}

    # 4. Manager should be able to create a task for the Employee
    task_payload = {
        "work_description": "Prepare quarterly project review",
        "assigned_to": str(employee.id),
        "priority": "high",
        "complexity": "medium",
        "deadline": (datetime.utcnow() + timedelta(days=3)).isoformat()
    }
    response = await client.post("/tasks", json=task_payload, headers=mgr_headers)
    assert response.status_code == 201
    task_id = response.json()["id"]

    # 5. Assistant Manager should be able to list all tasks
    response = await client.get("/tasks", headers=am_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert response.json()[0]["work_description"] == "Prepare quarterly project review"

    # 6. Manager and AM should NOT be able to access Admin-only settings updates
    response = await client.put("/settings", json={"attendance_bonus_percentage": 15}, headers=mgr_headers)
    assert response.status_code == 403

    response = await client.put("/settings", json={"attendance_bonus_percentage": 15}, headers=am_headers)
    assert response.status_code == 403

    # 7. Employee should NOT be able to delete the task (403 Forbidden)
    response = await client.delete(f"/tasks/{task_id}", headers=emp_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_strict_hierarchical_filtering(client: AsyncClient):
    """Test strict hierarchical filtering across tasks, dashboard, and reports endpoints."""
    # 1. Clean old data or create isolated set of users
    mgr_a = User(
        name="Mgr A",
        email="mgr_a@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.MANAGER
    )
    await mgr_a.insert()

    am_b = User(
        name="AM B",
        email="am_b@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.ASSISTANT_MANAGER,
        parent_id=mgr_a.id
    )
    await am_b.insert()

    emp_c = User(
        name="Emp C",
        email="emp_c@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.EMPLOYEE,
        parent_id=am_b.id
    )
    await emp_c.insert()

    mgr_d = User(
        name="Mgr D",
        email="mgr_d@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.MANAGER
    )
    await mgr_d.insert()

    emp_e = User(
        name="Emp E",
        email="emp_e@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.EMPLOYEE,
        parent_id=mgr_d.id
    )
    await emp_e.insert()

    # 2. Login all of them
    async def get_headers(email):
        resp = await client.post("/auth/login", json={"email": email, "password": "password123"})
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    headers_mgr_a = await get_headers("mgr_a@example.com")
    headers_am_b = await get_headers("am_b@example.com")
    headers_emp_c = await get_headers("emp_c@example.com")

    # 3. Create tasks for Emp C and Emp E
    task_c = Task(
        work_description="Task for Emp C",
        assigned_to=emp_c.id,
        assigned_to_name=emp_c.name,
        created_by=mgr_a.id,
        deadline=datetime.utcnow() + timedelta(days=2),
        company_id=None,
        category_ids=[],
        category_names=[]
    )
    await task_c.insert()

    task_e = Task(
        work_description="Task for Emp E",
        assigned_to=emp_e.id,
        assigned_to_name=emp_e.name,
        created_by=mgr_d.id,
        deadline=datetime.utcnow() + timedelta(days=2),
        company_id=None,
        category_ids=[],
        category_names=[]
    )
    await task_e.insert()

    # 4. Verify Tasks filtering
    # Mgr A should see Task C, but NOT Task E
    response = await client.get("/tasks", headers=headers_mgr_a)
    assert response.status_code == 200
    task_ids = [t["id"] for t in response.json()]
    assert str(task_c.id) in task_ids
    assert str(task_e.id) not in task_ids

    # AM B should see Task C, but NOT Task E
    response = await client.get("/tasks", headers=headers_am_b)
    assert response.status_code == 200
    task_ids = [t["id"] for t in response.json()]
    assert str(task_c.id) in task_ids
    assert str(task_e.id) not in task_ids

    # Emp C should see Task C, but NOT Task E
    response = await client.get("/tasks", headers=headers_emp_c)
    assert response.status_code == 200
    task_ids = [t["id"] for t in response.json()]
    assert str(task_c.id) in task_ids
    assert str(task_e.id) not in task_ids

    # 5. Verify Dashboard filtering
    response = await client.get("/dashboard/admin", headers=headers_mgr_a)
    assert response.status_code == 200
    data = response.json()
    # Should only count employees in Mgr A's hierarchy (AM B and Emp C)
    assert data["employees"]["total"] == 2

    # 6. Verify Reports/Payroll filtering
    response = await client.get("/reports/payroll", headers=headers_mgr_a)
    assert response.status_code == 200
    payroll_data = response.json()
    employee_ids = [p["employee_id"] for p in payroll_data]
    assert str(emp_c.id) in employee_ids
    assert str(emp_e.id) not in employee_ids


@pytest.mark.asyncio
async def test_multitenant_isolation_and_scoping(client: AsyncClient):
    """Test strict scoping of companies, tasks, and holidays across tenants."""
    from app.models.holiday import Holiday
    
    # 1. Create two separate companies
    comp_a = Company(
        name="Company A",
        work_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        work_start_time="09:00 AM",
        work_end_time="05:00 PM",
        cut_out_time="09:30 AM"
    )
    await comp_a.insert()
    
    comp_b = Company(
        name="Company B",
        work_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        work_start_time="09:00 AM",
        work_end_time="05:00 PM",
        cut_out_time="09:30 AM"
    )
    await comp_b.insert()
    
    # 2. Create Admin for Company A and Employee for Company B
    admin_a = User(
        name="Admin A",
        email="admina@example.com",
        password_hash=hash_password("adminpass123"),
        role=UserRole.ADMIN,
        company_id=comp_a.id
    )
    await admin_a.insert()
    
    comp_a.owner_id = admin_a.id
    await comp_a.save()
    
    emp_b = User(
        name="Employee B",
        email="empb@example.com",
        password_hash=hash_password("emppass123"),
        role=UserRole.EMPLOYEE,
        company_id=comp_b.id
    )
    await emp_b.insert()
    
    # 3. Log in as both users
    res_login_a = await client.post("/auth/login", json={"email": "admina@example.com", "password": "adminpass123"})
    token_a = res_login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    res_login_b = await client.post("/auth/login", json={"email": "empb@example.com", "password": "emppass123"})
    token_b = res_login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # 4. Verify Company list scoping
    # Admin A should only see Company A
    res_comps_a = await client.get("/companies", headers=headers_a)
    assert res_comps_a.status_code == 200
    comp_ids_a = [c["id"] for c in res_comps_a.json()]
    assert str(comp_a.id) in comp_ids_a
    assert str(comp_b.id) not in comp_ids_a
    
    # Employee B should only see Company B
    res_comps_b = await client.get("/companies", headers=headers_b)
    assert res_comps_b.status_code == 200
    comp_ids_b = [c["id"] for c in res_comps_b.json()]
    assert str(comp_b.id) in comp_ids_b
    assert str(comp_a.id) not in comp_ids_b
    
    # 5. Verify Holiday Scoping
    # Admin A creates a holiday for Company A (should succeed)
    res_holiday_create = await client.post(
        "/holidays",
        json={"name": "New Year A", "date": (datetime.utcnow() + timedelta(days=10)).isoformat(), "company_id": str(comp_a.id)},
        headers=headers_a
    )
    assert res_holiday_create.status_code == 201
    holiday_id = res_holiday_create.json()["id"]
    
    # Admin A tries to create a holiday for Company B (should fail with 403)
    res_holiday_fail = await client.post(
        "/holidays",
        json={"name": "New Year B", "date": (datetime.utcnow() + timedelta(days=10)).isoformat(), "company_id": str(comp_b.id)},
        headers=headers_a
    )
    assert res_holiday_fail.status_code == 403
    
    # Admin A tries to delete a global holiday (should fail since only Super Admin can)
    global_holiday = Holiday(name="Global Day", date=datetime.utcnow() + timedelta(days=10), company_id=None)
    await global_holiday.insert()
    res_holiday_delete_fail = await client.delete(f"/holidays/{global_holiday.id}", headers=headers_a)
    assert res_holiday_delete_fail.status_code == 403
    
    # 6. Verify Task company-limit during creation
    # Admin A tries to create a task assigned to Company B (should fail with 403)
    res_task_create_fail = await client.post(
        "/tasks",
        json={
            "work_description": "Cross company task",
            "priority": "regular",
            "complexity": "low",
            "deadline": (datetime.utcnow() + timedelta(days=5)).isoformat(),
            "company_id": str(comp_b.id),
            "assigned_to": str(admin_a.id)
        },
        headers=headers_a
    )
    assert res_task_create_fail.status_code == 403

