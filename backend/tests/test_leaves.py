"""
Tests for the Leaves Management endpoints.
"""
import pytest
from datetime import datetime, timedelta


# ─── Helpers ────────────────────────────────────────────────────────────

async def register_user(client, name, email, password, role="employee"):
    """Register admin first, then create user through admin API."""
    return await client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
        "role": role,
    })


async def login_user(client, email, password):
    """Login and return auth headers."""
    res = await client.post("/auth/login", json={"email": email, "password": password})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def setup_company_and_hierarchy(client):
    """
    Set up a full hierarchy:
    - Admin (owns company)
    - Manager (reports to admin)
    - Assistant Manager (reports to manager)
    - Employee (reports to assistant manager)
    """
    # Register admin
    await register_user(client, "Test Admin", "admin@test.com", "admin123", "admin")
    admin_headers = await login_user(client, "admin@test.com", "admin123")

    # Create company
    company_res = await client.post("/companies", json={
        "name": "Test Corp",
        "description": "Test company"
    }, headers=admin_headers)
    company_id = company_res.json()["id"]

    # Create manager
    await client.post("/admin/employees", json={
        "name": "Test Manager",
        "email": "manager@test.com",
        "password": "manager123",
        "role": "manager",
        "company_id": company_id,
    }, headers=admin_headers)
    manager_headers = await login_user(client, "manager@test.com", "manager123")

    # Get manager ID
    mgr_login = await client.post("/auth/login", json={"email": "manager@test.com", "password": "manager123"})
    manager_id = mgr_login.json()["user"]["id"]

    # Create assistant manager
    await client.post("/admin/employees", json={
        "name": "Test ASM",
        "email": "asm@test.com",
        "password": "asm12345",
        "role": "assistant_manager",
        "company_id": company_id,
        "parent_id": manager_id,
    }, headers=admin_headers)
    asm_headers = await login_user(client, "asm@test.com", "asm12345")

    # Get ASM ID
    asm_login = await client.post("/auth/login", json={"email": "asm@test.com", "password": "asm12345"})
    asm_id = asm_login.json()["user"]["id"]

    # Create employee
    await client.post("/admin/employees", json={
        "name": "Test Employee",
        "email": "emp@test.com",
        "password": "emp12345",
        "role": "employee",
        "company_id": company_id,
        "parent_id": asm_id,
    }, headers=admin_headers)
    emp_headers = await login_user(client, "emp@test.com", "emp12345")

    return {
        "company_id": company_id,
        "admin_headers": admin_headers,
        "manager_headers": manager_headers,
        "asm_headers": asm_headers,
        "emp_headers": emp_headers,
        "manager_id": manager_id,
        "asm_id": asm_id,
    }


# ─── Tests ──────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_apply_leave_success(client):
    """Employee can apply for a leave."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=6)).strftime("%Y-%m-%dT00:00:00")

    res = await client.post("/leaves", json={
        "leave_type": "sick",
        "start_date": start,
        "end_date": end,
        "reason": "Feeling unwell",
    }, headers=ctx["emp_headers"])

    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert data["leave_type"] == "sick"
    assert data["duration_days"] == 2


@pytest.mark.anyio
async def test_apply_leave_invalid_dates(client):
    """Cannot apply with start > end."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%dT00:00:00")

    res = await client.post("/leaves", json={
        "leave_type": "casual",
        "start_date": start,
        "end_date": end,
        "reason": "Holiday",
    }, headers=ctx["emp_headers"])

    assert res.status_code == 400
    assert "Start date" in res.json()["detail"]


@pytest.mark.anyio
async def test_apply_leave_overlap(client):
    """Cannot apply for overlapping leaves."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=20)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=22)).strftime("%Y-%m-%dT00:00:00")

    # First leave
    res1 = await client.post("/leaves", json={
        "leave_type": "casual",
        "start_date": start,
        "end_date": end,
        "reason": "Trip",
    }, headers=ctx["emp_headers"])
    assert res1.status_code == 201

    # Overlapping leave
    overlap_start = (datetime.utcnow() + timedelta(days=21)).strftime("%Y-%m-%dT00:00:00")
    overlap_end = (datetime.utcnow() + timedelta(days=23)).strftime("%Y-%m-%dT00:00:00")

    res2 = await client.post("/leaves", json={
        "leave_type": "sick",
        "start_date": overlap_start,
        "end_date": overlap_end,
        "reason": "Sick",
    }, headers=ctx["emp_headers"])
    assert res2.status_code == 409


@pytest.mark.anyio
async def test_get_balances(client):
    """User can view their leave balances."""
    ctx = await setup_company_and_hierarchy(client)

    res = await client.get("/leaves/balances", headers=ctx["emp_headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["year"] == datetime.utcnow().year
    assert len(data["balances"]) == 4

    # Check sick balance
    sick = next(b for b in data["balances"] if b["leave_type"] == "sick")
    assert sick["allowed"] == 12
    assert sick["used"] == 0
    assert sick["remaining"] == 12


@pytest.mark.anyio
async def test_get_my_leaves(client):
    """User can view their own leave history."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=31)).strftime("%Y-%m-%dT00:00:00")

    await client.post("/leaves", json={
        "leave_type": "paid",
        "start_date": start,
        "end_date": end,
        "reason": "Personal work",
    }, headers=ctx["emp_headers"])

    res = await client.get("/leaves/me", headers=ctx["emp_headers"])
    assert res.status_code == 200
    assert len(res.json()) == 1


@pytest.mark.anyio
async def test_subordinate_leaves_visible_to_manager(client):
    """Manager can see subordinate leave requests."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=40)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=41)).strftime("%Y-%m-%dT00:00:00")

    # Employee applies
    await client.post("/leaves", json={
        "leave_type": "sick",
        "start_date": start,
        "end_date": end,
        "reason": "Fever",
    }, headers=ctx["emp_headers"])

    # Manager views subordinate leaves
    res = await client.get("/leaves/subordinates", headers=ctx["manager_headers"])
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.anyio
async def test_employee_cannot_view_subordinate_leaves(client):
    """Employee cannot access subordinate leaves endpoint."""
    ctx = await setup_company_and_hierarchy(client)

    res = await client.get("/leaves/subordinates", headers=ctx["emp_headers"])
    assert res.status_code == 403


@pytest.mark.anyio
async def test_approve_leave(client):
    """Manager can approve a subordinate's leave."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=50)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=51)).strftime("%Y-%m-%dT00:00:00")

    # Employee applies
    apply_res = await client.post("/leaves", json={
        "leave_type": "casual",
        "start_date": start,
        "end_date": end,
        "reason": "Family event",
    }, headers=ctx["emp_headers"])
    leave_id = apply_res.json()["id"]

    # Manager approves
    res = await client.patch(f"/leaves/{leave_id}/status", json={
        "status": "approved",
    }, headers=ctx["manager_headers"])

    assert res.status_code == 200
    assert res.json()["status"] == "approved"


@pytest.mark.anyio
async def test_reject_leave_with_reason(client):
    """Manager can reject a leave with a reason."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=60)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=61)).strftime("%Y-%m-%dT00:00:00")

    apply_res = await client.post("/leaves", json={
        "leave_type": "paid",
        "start_date": start,
        "end_date": end,
        "reason": "Vacation",
    }, headers=ctx["emp_headers"])
    leave_id = apply_res.json()["id"]

    res = await client.patch(f"/leaves/{leave_id}/status", json={
        "status": "rejected",
        "rejection_reason": "Insufficient coverage during that period",
    }, headers=ctx["manager_headers"])

    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert res.json()["rejection_reason"] == "Insufficient coverage during that period"


@pytest.mark.anyio
async def test_employee_cannot_approve_leave(client):
    """Employee cannot approve/reject leaves."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=70)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=71)).strftime("%Y-%m-%dT00:00:00")

    apply_res = await client.post("/leaves", json={
        "leave_type": "sick",
        "start_date": start,
        "end_date": end,
        "reason": "Test",
    }, headers=ctx["emp_headers"])
    leave_id = apply_res.json()["id"]

    res = await client.patch(f"/leaves/{leave_id}/status", json={
        "status": "approved",
    }, headers=ctx["emp_headers"])

    assert res.status_code == 403


@pytest.mark.anyio
async def test_cancel_leave(client):
    """Employee can cancel their own pending leave."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=80)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=81)).strftime("%Y-%m-%dT00:00:00")

    apply_res = await client.post("/leaves", json={
        "leave_type": "casual",
        "start_date": start,
        "end_date": end,
        "reason": "Changed plans",
    }, headers=ctx["emp_headers"])
    leave_id = apply_res.json()["id"]

    res = await client.delete(f"/leaves/{leave_id}", headers=ctx["emp_headers"])
    assert res.status_code == 200
    assert "cancelled" in res.json()["message"].lower()

    # Verify it's gone
    my_leaves = await client.get("/leaves/me", headers=ctx["emp_headers"])
    assert len(my_leaves.json()) == 0


@pytest.mark.anyio
async def test_balance_decreases_after_approval(client):
    """Balances correctly reflect approved leaves."""
    ctx = await setup_company_and_hierarchy(client)
    start = (datetime.utcnow() + timedelta(days=90)).strftime("%Y-%m-%dT00:00:00")
    end = (datetime.utcnow() + timedelta(days=92)).strftime("%Y-%m-%dT00:00:00")

    # Apply for 3 days sick leave
    apply_res = await client.post("/leaves", json={
        "leave_type": "sick",
        "start_date": start,
        "end_date": end,
        "reason": "Surgery recovery",
    }, headers=ctx["emp_headers"])
    leave_id = apply_res.json()["id"]

    # Manager approves
    await client.patch(f"/leaves/{leave_id}/status", json={
        "status": "approved",
    }, headers=ctx["manager_headers"])

    # Check balance
    res = await client.get("/leaves/balances", headers=ctx["emp_headers"])
    sick = next(b for b in res.json()["balances"] if b["leave_type"] == "sick")
    assert sick["used"] == 3
    assert sick["remaining"] == 9  # 12 - 3
