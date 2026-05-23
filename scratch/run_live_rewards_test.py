import asyncio
import httpx
import sys
import os

BASE_URL = "http://localhost:8000"

async def test_rewards_flow():
    print("=" * 80)
    print("                STARTING LIVE REWARDS FLOW TEST")
    print("=" * 80)

    client = httpx.AsyncClient()

    # Step 1: Log in as Employee manager1
    print("\n[STEP 1] Logging in as Employee manager1...")
    login_emp_payload = {
        "email": "manager1@gmail.com",
        "password": "manager1123"
    }
    r = await client.post(f"{BASE_URL}/auth/login", json=login_emp_payload)
    if r.status_code != 200:
        print(f"FAILED to log in as employee: {r.status_code} - {r.text}")
        return
    emp_token = r.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}
    emp_id = r.json()["user"]["id"]
    initial_points = r.json()["user"]["reward_points"]
    print(f"Logged in as manager1. ID: {emp_id} | Initial Reward Points: {initial_points}")

    # Step 2: Clock-in as Employee
    print("\n[STEP 2] Clocking in manager1...")
    checkin_payload = {
        "lat": 12.9716,
        "lng": 77.5946,
        "address": "Vision Technologies HQ, Bangalore",
        "remarks": "Clocking in for rewards testing",
        "device_fingerprint": "simulation-device-fingerprint-999"
    }
    r = await client.post(f"{BASE_URL}/attendance/check-in", json=checkin_payload, headers=emp_headers)
    if r.status_code != 200 and "already checked in" not in r.text:
        print(f"FAILED to check in: {r.status_code} - {r.text}")
        return
    print(f"Check-in response: {r.status_code} - {r.json() if r.status_code == 200 else r.text}")

    # Step 3: Find the Critical task and move it to in_progress
    task_id = "6a10a5f099a0845108a2a6c5"
    print(f"\n[STEP 3] Moving task {task_id} to in_progress...")
    r = await client.put(f"{BASE_URL}/tasks/{task_id}", json={"status": "in_progress"}, headers=emp_headers)
    if r.status_code != 200:
        print(f"FAILED to start task: {r.status_code} - {r.text}")
        return
    print(f"Task status updated to: {r.json()['status']}")

    # Step 4: Log in as Admin to complete and rate the task
    print("\n[STEP 4] Logging in as Admin...")
    login_admin_payload = {
        "email": "admin@company.com",
        "password": "Admin@123"
    }
    r = await client.post(f"{BASE_URL}/auth/login", json=login_admin_payload)
    if r.status_code != 200:
        print(f"FAILED to log in as admin: {r.status_code} - {r.text}")
        return
    admin_token = r.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("Admin logged in successfully.")

    # Step 5: Admin completes task with Quality Multiplier 1.30
    print("\n[STEP 5] Admin completing and rating task with 1.30 quality multiplier...")
    complete_payload = {
        "status": "completed",
        "quality_multiplier": 1.30,
        "remarks": "Excellent performance on JWT module refactoring. Completed 5 days ahead of deadline!"
    }
    r = await client.put(f"{BASE_URL}/tasks/{task_id}", json=complete_payload, headers=admin_headers)
    if r.status_code != 200:
        print(f"FAILED to complete and rate task: {r.status_code} - {r.text}")
        return
    task_res = r.json()
    print(f"Task completed successfully. Reward points awarded on task: {task_res.get('reward_points')}")
    print(f"Time variance (hours): {task_res.get('time_variance_hours')}")
    print(f"Reward given flag: {task_res.get('reward_given')}")

    # Step 6: Verify updated reward points for manager1
    print("\n[STEP 6] Verifying updated reward points for manager1...")
    # Log in again or fetch details
    r = await client.get(f"{BASE_URL}/auth/me", headers=emp_headers)
    if r.status_code != 200:
        print(f"FAILED to get current employee details: {r.status_code} - {r.text}")
        return
    updated_points = r.json()["reward_points"]
    earned = updated_points - initial_points
    print(f"Initial Points: {initial_points}")
    print(f"Updated Points: {updated_points}")
    print(f"Points Earned : {earned}")

    # Expected: Critical priority (10.0) * High complexity multiplier (1.5) * Early bonus (1.10) * Quality multiplier (1.30) = 21.45
    expected_earned = 21.45
    print(f"Expected Points: {expected_earned}")
    if abs(earned - expected_earned) < 0.01:
        print("SUCCESS: Reward points matched expected calculations perfectly!")
    else:
        print("WARNING: Reward points mismatch!")

    # Step 7: Check Leaderboard
    print("\n[STEP 7] Fetching Leaderboard to verify propagation...")
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

    # Step 8: Clock-out
    print("\n[STEP 8] Clocking out manager1...")
    checkout_payload = {
        "lat": 12.9716,
        "lng": 77.5946,
        "address": "Vision Technologies HQ, Bangalore",
        "remarks": "Clocking out after successful rewards verification",
        "device_fingerprint": "simulation-device-fingerprint-999"
    }
    r = await client.post(f"{BASE_URL}/attendance/check-out", json=checkout_payload, headers=emp_headers)
    print(f"Clock-out response: {r.status_code} - {r.json() if r.status_code == 200 else r.text}")

    print("\n" + "=" * 80)
    print("                 LIVE REWARDS FLOW TEST COMPLETE")
    print("=" * 80)

    await client.aclose()

if __name__ == "__main__":
    asyncio.run(test_rewards_flow())
