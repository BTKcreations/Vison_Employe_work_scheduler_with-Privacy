import pytest
from datetime import datetime, timedelta

from app.auth.password import hash_password
from app.models.company import Company
from app.models.task import Task
from app.models.user import User, UserRole


async def login_headers(client, email: str, password: str = "password123"):
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio
async def test_search_escapes_regex_input(client):
    company = Company(name="Regex Safety Co")
    await company.insert()
    employee = User(
        name="Literal User",
        email="literal@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.EMPLOYEE,
        company_id=company.id,
    )
    await employee.insert()

    headers = await login_headers(client, employee.email)
    response = await client.get("/search?q=.*", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"employees": [], "companies": [], "tasks": []}


@pytest.mark.asyncio
async def test_search_is_tenant_scoped_for_admin_and_employee(client):
    company_a = Company(name="Needle Company A")
    company_b = Company(name="Needle Company B")
    await company_a.insert()
    await company_b.insert()

    admin_a = User(
        name="Admin A",
        email="admin_a_search@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.ADMIN,
        company_id=company_a.id,
    )
    admin_b = User(
        name="Admin B",
        email="admin_b_search@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.ADMIN,
        company_id=company_b.id,
    )
    employee_a = User(
        name="Needle Employee A",
        email="needle_a@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.EMPLOYEE,
        company_id=company_a.id,
    )
    employee_b = User(
        name="Needle Employee B",
        email="needle_b@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.EMPLOYEE,
        company_id=company_b.id,
    )
    await admin_a.insert()
    await admin_b.insert()
    await employee_a.insert()
    await employee_b.insert()

    company_a.owner_id = admin_a.id
    company_b.owner_id = admin_b.id
    await company_a.save()
    await company_b.save()

    task_a = Task(
        work_description="Needle task for tenant A",
        assigned_to=employee_a.id,
        created_by=admin_a.id,
        deadline=datetime.utcnow() + timedelta(days=1),
        company_id=company_a.id,
    )
    task_b = Task(
        work_description="Needle task for tenant B",
        assigned_to=employee_b.id,
        created_by=admin_b.id,
        deadline=datetime.utcnow() + timedelta(days=1),
        company_id=company_b.id,
    )
    await task_a.insert()
    await task_b.insert()

    admin_headers = await login_headers(client, admin_a.email)
    admin_response = await client.get("/search?q=Needle", headers=admin_headers)
    assert admin_response.status_code == 200
    admin_data = admin_response.json()
    assert {item["id"] for item in admin_data["employees"]} == {str(employee_a.id)}
    assert {item["id"] for item in admin_data["companies"]} == {str(company_a.id)}
    assert {item["id"] for item in admin_data["tasks"]} == {str(task_a.id)}

    employee_headers = await login_headers(client, employee_a.email)
    employee_response = await client.get("/search?q=Needle", headers=employee_headers)
    assert employee_response.status_code == 200
    employee_data = employee_response.json()
    assert {item["id"] for item in employee_data["employees"]} == {str(employee_a.id)}
    assert {item["id"] for item in employee_data["companies"]} == {str(company_a.id)}
    assert {item["id"] for item in employee_data["tasks"]} == {str(task_a.id)}


@pytest.mark.asyncio
async def test_search_is_hierarchy_scoped_for_manager(client):
    company = Company(name="Hierarchy Search Co")
    await company.insert()

    manager = User(
        name="Search Manager",
        email="manager_search@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.MANAGER,
        company_id=company.id,
    )
    await manager.insert()
    subordinate = User(
        name="Needle Subordinate",
        email="subordinate_search@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.EMPLOYEE,
        company_id=company.id,
        parent_id=manager.id,
    )
    peer = User(
        name="Needle Peer",
        email="peer_search@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.EMPLOYEE,
        company_id=company.id,
    )
    await subordinate.insert()
    await peer.insert()

    subordinate_task = Task(
        work_description="Needle subordinate task",
        assigned_to=subordinate.id,
        created_by=manager.id,
        deadline=datetime.utcnow() + timedelta(days=1),
        company_id=company.id,
    )
    peer_task = Task(
        work_description="Needle peer task",
        assigned_to=peer.id,
        created_by=peer.id,
        deadline=datetime.utcnow() + timedelta(days=1),
        company_id=company.id,
    )
    await subordinate_task.insert()
    await peer_task.insert()

    headers = await login_headers(client, manager.email)
    response = await client.get("/search?q=Needle", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert {item["id"] for item in data["employees"]} == {str(subordinate.id)}
    assert {item["id"] for item in data["tasks"]} == {str(subordinate_task.id)}

