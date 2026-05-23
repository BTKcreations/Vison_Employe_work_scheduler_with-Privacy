import asyncio
import os
import sys
from bson import ObjectId

# Adjust path to import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

os.environ["DATABASE_NAME"] = "employee_task_reward3"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"

from app.database.connection import init_db
from app.models.user import User
from app.models.company import Company
from app.models.task import Task
from app.models.system_settings import SystemSettings

async def main():
    await init_db()
    print("=== System Settings ===")
    settings = await SystemSettings.find_one({"singleton_id": "default"})
    if settings:
        print(f"Priority Points: {settings.priority_points}")
        print(f"Complexity Multipliers: {settings.complexity_multipliers}")
        print(f"Delay Reductions: {settings.delay_reductions}")
        print(f"Early Completion Bonus: {settings.early_completion_bonus}")
        print(f"Incentive Tiers: {settings.incentive_tiers}")
    else:
        print("No settings found!")

    print("\n=== Companies ===")
    companies = await Company.find_all().to_list()
    for c in companies:
        print(f"ID: {c.id} | Name: {c.name} | Geofence: ({c.office_lat}, {c.office_lng}) Radius: {c.geofence_radius_meters}m Policy: {c.geofence_policy}")

    print("\n=== Users ===")
    users = await User.find_all().to_list()
    for u in users:
        print(f"ID: {u.id} | Name: {u.name} | Email: {u.email} | Role: {u.role} | Points: {u.reward_points} | Company ID: {u.company_id}")

    print("\n=== All Tasks ===")
    tasks = await Task.find_all().to_list()
    for t in tasks:
        print(f"ID: {t.id} | Desc: {t.work_description[:40]} | Assigned: {t.assigned_to_name} | Status: {t.status} | Reward Given: {t.reward_given} | Reward Points: {t.reward_points}")

if __name__ == "__main__":
    asyncio.run(main())
