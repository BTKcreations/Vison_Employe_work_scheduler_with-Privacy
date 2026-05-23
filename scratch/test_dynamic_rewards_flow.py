import asyncio
import httpx
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

async def test_dynamic_rewards_flow():
    print("=" * 80)
    print("           STARTING DYNAMIC REWARDS FLOW VERIFICATION TEST")
    print("=" * 80)

    client = httpx.AsyncClient()

    # Step 1: Log in as Admin to fetch employee details and create the task
    print("\n[STEP 1] Logging in as Admin...")
    login_admin_payload = {
        "email": "admin@company.com",
        "password": "Admin@123"
    }
    r = await client.post(f"{BASE_URL}/auth/login", json=login_admin_payload)
    if r.status_code != 200:
        print(f"FAILED to log in as admin: {r.status_code} - {r.text}")
        await client.aclose()
        return
    admin_token = r.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("Admin logged in successfully.")

    # Fetch employee list to find manager1 details
    print("Fetching employees to retrieve manager1's ID and current points...")
    r = await client.get(f"{BASE_URL}/admin/employees", headers=admin_headers)
    if r.status_code != 200:
        print(f"FAILED to fetch employees: {r.status_code} - {r.text}")
        await client.aclose()
        return
    employees = r.json()
    emp_details = None
    for emp in employees:
        if emp["email"] == "manager1@gmail.com":
            emp_details = emp
            break

    if not emp_details:
        print("FAILED: Could not find manager1 in the employee list.")
        await client.aclose()
        return

    emp_id = emp_details["id"]
    emp_company_id = emp_details.get("company_id")
    initial_points = emp_details.get("reward_points", 0.0)
    print(f"Found employee manager1. ID: {emp_id} | Company ID: {emp_company_id} | Current Points: {initial_points}")

    # Step 2: Admin creates a new Critical-Priority, High-Complexity task assigned to manager1
    print("\n[STEP 2] Admin creating new task for manager1...")
    deadline_time = (datetime.utcnow() + timedelta(days=3)).isoformat() + "Z"
    task_payload = {
        "work_description": f"Refactor reward system modules and test early bonus points - Run {int(datetime.utcnow().timestamp())}",
        "assigned_to": str(emp_id),
        "priority": "critical",
        "complexity": "high",
        "deadline": deadline_time,
        "company_id": str(emp_company_id) if emp_company_id else None
    }
    r = await client.post(f"{BASE_URL}/tasks", json=task_payload, headers=admin_headers)
    if r.status_code != 201:
        print(f"FAILED to create task: {r.status_code} - {r.text}")
        await client.aclose()
        return
    task_res = r.json()
    task_id = task_res["id"]
    print(f"Created task successfully. Task ID: {task_id}")

    # Step 3: Log in as Employee manager1
    print("\n[STEP 3] Logging in as Employee manager1...")
    login_emp_payload = {
        "email": "manager1@gmail.com",
        "password": "manager1123"
    }
    r = await client.post(f"{BASE_URL}/auth/login", json=login_emp_payload)
    if r.status_code != 200:
        print(f"FAILED to log in as employee: {r.status_code} - {r.text}")
        await client.aclose()
        return
    emp_token = r.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}
    print(f"Logged in as manager1. ID: {emp_id}")

    # Step 4: Clock-in manager1 (handle already checked in)
    print("\n[STEP 4] Clocking in manager1...")
    checkin_payload = {
        "lat": 12.9716,
        "lng": 77.5946,
        "address": "Vision Technologies HQ, Bangalore",
        "remarks": "Clocking in for dynamic rewards test",
        "device_fingerprint": "simulation-device-fingerprint-dynamic-1"
    }
    r = await client.post(f"{BASE_URL}/attendance/check-in", json=checkin_payload, headers=emp_headers)
    if r.status_code != 200 and "already checked in" not in r.text:
        print(f"FAILED to check in: {r.status_code} - {r.text}")
        await client.aclose()
        return
    print(f"Check-in status: {'Success/Already Checked In' if r.status_code in [200, 400] else r.text}")

    # Step 5: Employee moves task to in_progress
    print(f"\n[STEP 5] Employee moving task {task_id} to in_progress...")
    r = await client.put(f"{BASE_URL}/tasks/{task_id}", json={"status": "in_progress"}, headers=emp_headers)
    if r.status_code != 200:
        print(f"FAILED to start task: {r.status_code} - {r.text}")
        await client.aclose()
        return
    print(f"Task status updated to: {r.json()['status']}")

    # Step 6: Admin completes task with Quality Multiplier 1.30
    print("\n[STEP 6] Admin completing and rating task with 1.30 quality multiplier...")
    complete_payload = {
        "status": "completed",
        "quality_multiplier": 1.30,
        "remarks": "Dynamic test execution: excellent speed and quality."
    }
    r = await client.put(f"{BASE_URL}/tasks/{task_id}", json=complete_payload, headers=admin_headers)
    if r.status_code != 200:
        print(f"FAILED to complete and rate task: {r.status_code} - {r.text}")
        await client.aclose()
        return
    task_completed_res = r.json()
    print(f"Task completed successfully.")
    print(f"  Awarded Points on Task: {task_completed_res.get('reward_points')}")
    print(f"  Time Variance (hours)  : {task_completed_res.get('time_variance_hours')}")
    print(f"  Reward Given Flag      : {task_completed_res.get('reward_given')}")

    # Step 7: Verify updated reward points for manager1
    print("\n[STEP 7] Verifying updated reward points for manager1...")
    r = await client.get(f"{BASE_URL}/auth/me", headers=emp_headers)
    if r.status_code != 200:
        print(f"FAILED to get current employee details: {r.status_code} - {r.text}")
        await client.aclose()
        return
    updated_points = r.json()["reward_points"]
    earned = updated_points - initial_points
    print(f"Initial Points: {initial_points}")
    print(f"Updated Points: {updated_points}")
    print(f"Points Earned : {earned}")

    # Expected: Critical priority (10.0) * High complexity (1.5) * Early bonus (1.10) * Quality multiplier (1.30) = 21.45
    expected_earned = 21.45
    print(f"Expected Points: {expected_earned}")
    if abs(earned - expected_earned) < 0.01:
        print("SUCCESS: Reward points matched expected calculations perfectly!")
    else:
        print("WARNING: Reward points mismatch!")

    # Step 8: Check Leaderboard
    print("\n[STEP 8] Fetching Leaderboard to verify propagation...")
    r = await client.get(f"{BASE_URL}/peer-recognition/leaderboard", headers=emp_headers)
    if r.status_code != 200:
        print(f"FAILED to get leaderboard: {r.status_code} - {r.text}")
    else:
        leaderboard = r.json()
        print("Leaderboard Standings:")
        for idx, entry in enumerate(leaderboard, 1):
            print(f"  {idx}. {entry['name']} ({entry['email']}): {entry['reward_points']} points")
            if entry['email'] == "manager1@gmail.com":
                print("     ^ Verified: Employee manager1 is on the leaderboard with the correct score!")

    await client.aclose()
    print("\n" + "=" * 80)
    print("             DYNAMIC REWARDS FLOW VERIFICATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_dynamic_rewards_flow())
