"""
Database migration script to copy and upgrade data from 'employee_task_reward1' to 'employee_task_reward_migrated'.
"""
import os
import sys
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
# If it is local url, check if it has the Atlas string or if we should use Atlas string.
# Since the user specifically requested Atlas migration, we will use the Atlas connection string if defined.
ATLAS_URL = "mongodb+srv://employee-task-management:employee-task-management@employee-task-managemen.bf806ra.mongodb.net/?appName=Employee-task-management"

if "mongodb+srv" in MONGODB_URL or "bf806ra.mongodb.net" in MONGODB_URL:
    connection_url = MONGODB_URL
else:
    print(f"[INFO] Using hardcoded MongoDB Atlas URL...")
    connection_url = ATLAS_URL

SOURCE_DB_NAME = "employee_task_reward1"
TARGET_DB_NAME = "employee_task_reward4"

# Pre-defined user company mappings based on task assignments
USER_COMPANY_MAPPING = {
    ObjectId("69fc73def2e06b34d2cfd2eb"): ObjectId("69fc74f4f2e06b34d2cfd2f1"), # Nishitha Chovva -> VISION REAL VENTURES LLP
    ObjectId("69fc737a770f6149aacfd2eb"): ObjectId("69fc7571f2e06b34d2cfd2f5"), # Umesh Sharma -> SRI SAI LOGISTICS
    ObjectId("69fc73a5770f6149aacfd2ed"): ObjectId("69fc752af2e06b34d2cfd2f3"), # Sujeeth Reddy Karrenagari -> SHIVAY ENTERPRISES
    ObjectId("69fc7424f2e06b34d2cfd2ed"): ObjectId("69fc74f4f2e06b34d2cfd2f1"), # Dhonthi Raju -> VISION REAL VENTURES LLP
    ObjectId("69fc7475770f6149aacfd2f3"): ObjectId("69fc752af2e06b34d2cfd2f3"), # Mounika Boddula -> SHIVAY ENTERPRISES
    ObjectId("69fc749df2e06b34d2cfd2ef"): ObjectId("69fc74f4f2e06b34d2cfd2f1"), # B. Sai Kumar -> VISION REAL VENTURES LLP
    ObjectId("6a0acc4eff53da9e6e9ed4a5"): ObjectId("69fc74f4f2e06b34d2cfd2f1"), # Kashish -> VISION REAL VENTURES LLP
    ObjectId("6a0acc81ff53da9e6e9ed4a7"): ObjectId("69fc74f4f2e06b34d2cfd2f1"), # Durga Prasanthi -> VISION REAL VENTURES LLP
    ObjectId("6a0acc9cff53da9e6e9ed4a9"): ObjectId("69fc74f4f2e06b34d2cfd2f1"), # C. Akhila -> VISION REAL VENTURES LLP
    ObjectId("6a13e90ef8b133bead501694"): ObjectId("69fc74f4f2e06b34d2cfd2f1"), # Govviind Chitlangya -> VISION REAL VENTURES LLP
}

def get_db_client():
    print(f"Connecting to MongoDB at: {connection_url}")
    return MongoClient(connection_url)

def migrate():
    client = get_db_client()
    
    # Check databases
    db_names = client.list_database_names()
    if SOURCE_DB_NAME not in db_names:
        print(f"[ERROR] Source database '{SOURCE_DB_NAME}' not found. Existing: {db_names}")
        sys.exit(1)
        
    print(f"[INFO] Cleansing & Dropping existing Target Database '{TARGET_DB_NAME}' if any...")
    client.drop_database(TARGET_DB_NAME)
    
    src_db = client[SOURCE_DB_NAME]
    tgt_db = client[TARGET_DB_NAME]
    
    # 1. Migrate Companies
    print("\n--- Migrating Companies ---")
    company_defaults = {
        "description": None,
        "is_active": True,
        "work_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "work_start_time": "09:00",
        "work_end_time": "18:00",
        "work_type": "fixed",
        "flexible_hours": 8,
        "cut_out_time": "10:00",
        "office_lat": None,
        "office_lng": None,
        "geofence_radius_meters": 500,
        "geofence_policy": "flexible",
        "min_session_minutes": 30,
        "auto_checkout_enabled": True,
        "location_drift_threshold_km": 5.0,
        "task_priority_points": {
            "critical": 10.0,
            "high": 5.0,
            "medium": 3.0,
            "regular": 1.0,
            "low": 1.0
        },
        "delay_penalties": {
            "on_time": 1.0,
            "1_day_late": 0.75,
            "2_days_late": 0.50,
            "3_days_late": 0.25,
            "4_plus_days_late": 0.0
        },
        "early_completion_multiplier": 1.1,
        "quality_multipliers": {
            "rework": 0.8,
            "standard": 1.0,
            "exemplary": 1.2
        },
        "incentive_tiers": [
            {"min_performance": 0.0, "max_performance": 49.99, "pool_percentage": 0.0},
            {"min_performance": 50.0, "max_performance": 69.99, "pool_percentage": 35.0},
            {"min_performance": 70.0, "max_performance": 79.99, "pool_percentage": 75.0},
            {"min_performance": 80.0, "max_performance": 109.99, "pool_percentage": 100.0},
            {"min_performance": 110.0, "max_performance": 999.0, "pool_percentage": 150.0}
        ],
        "attendance_points": {
            "present": 1.0,
            "late_under_30": 0.75,
            "late_over_30": 0.5,
            "excused": 0.0,
            "unexcused": -1.0,
            "overtime": 1.25
        },
        "attendance_bonus_threshold": 95.0,
        "attendance_bonus_percentage": 5.0,
        "performance_incentive_pool_percentage": 25.0,
        "sick_leave_limit": 0,
        "earned_leave_limit": 0,
        "casual_leave_limit": 12,
        "max_paid_casual_leaves_per_month": 1,
    }
    
    companies = list(src_db.companies.find())
    for comp in companies:
        migrated_comp = company_defaults.copy()
        migrated_comp.update(comp)
        tgt_db.companies.insert_one(migrated_comp)
    print(f"Migrated {len(companies)} companies.")
    
    # 2. Migrate Categories
    print("\n--- Migrating Categories ---")
    categories = list(src_db.categories.find())
    for cat in categories:
        if "color" not in cat:
            cat["color"] = "#6366f1"
        tgt_db.categories.insert_one(cat)
    print(f"Migrated {len(categories)} categories.")
    
    # 3. Migrate Users
    print("\n--- Migrating Users ---")
    users = list(src_db.users.find())
    user_company_resolved = {}
    
    for u in users:
        u_id = u["_id"]
        role = u.get("role", "employee")
        
        # Determine company_id
        resolved_company_id = u.get("company_id")
        if not resolved_company_id:
            # Look in our pre-defined mapping
            resolved_company_id = USER_COMPANY_MAPPING.get(u_id)
            
        if not resolved_company_id and role not in ["admin"]:
            # If not in mapping, try to find dynamically from tasks
            task_comp_counts = {}
            for t in src_db.tasks.find({"assigned_to": u_id}):
                c_id = t.get("company_id")
                if c_id:
                    task_comp_counts[c_id] = task_comp_counts.get(c_id, 0) + 1
            if task_comp_counts:
                resolved_company_id = max(task_comp_counts, key=task_comp_counts.get)
                
        user_company_resolved[u_id] = resolved_company_id
        
        # Populate new fields & type conversions
        reward_pts = u.get("reward_points", 0)
        u["reward_points"] = float(reward_pts)
        
        if "is_deleted" not in u:
            u["is_deleted"] = False
        if "last_active" not in u:
            u["last_active"] = u.get("created_at", datetime.utcnow())
            
        u["company_id"] = resolved_company_id
        u["department_id"] = None
        u["branch_id"] = None
        u["reporting_manager_id"] = None
        u["hr_reporting_manager_id"] = None
        u["salary_structure_id"] = None
        
        # Mobile fields
        u["mobile"] = u.get("mobile") if u.get("mobile") else None
        u["alternate_mobile"] = u.get("alternate_mobile") if u.get("alternate_mobile") else None
        
        # Employee profile fields
        u["identity_card_type"] = None
        u["identity_card_url"] = None
        u["emergency_contact"] = None
        u["job_title"] = None
        u["department"] = None
        u["branch"] = None
        u["hiring_date"] = None
        u["hiring_company"] = None
        
        tgt_db.users.insert_one(u)
        
        # Seed Leave Balance for Employees
        if role in ["employee", "manager", "hr_manager", "assistant_hr_manager", "assistant_manager"]:
            tgt_db.leave_balances.insert_one({
                "user_id": u_id,
                "casual_allocated": 12,
                "casual_used": 0,
                "sick_allocated": 10,
                "sick_used": 0,
                "earned_allocated": 15,
                "earned_used": 0,
                "created_at": datetime.utcnow()
            })
            
    print(f"Migrated {len(users)} users (and seeded leave balances).")
    
    # 4. Migrate Tasks
    print("\n--- Migrating Tasks ---")
    tasks = list(src_db.tasks.find())
    for t in tasks:
        # Convert reward_points
        reward_pts = t.get("reward_points", 0)
        t["reward_points"] = float(reward_pts)
        
        # Multiplier and recurring tasks
        if "quality_multiplier" not in t:
            t["quality_multiplier"] = 1.0
        if "recurring_task_id" not in t:
            t["recurring_task_id"] = None
            
        # Title renaming to work_description
        if "title" in t and "work_description" not in t:
            t["work_description"] = t["title"]
            del t["title"]
            
        tgt_db.tasks.insert_one(t)
    print(f"Migrated {len(tasks)} tasks.")
    
    # 5. Migrate Attendance
    print("\n--- Migrating Attendance ---")
    attendance_records = list(src_db.attendance.find())
    corrected_count = 0
    for a in attendance_records:
        u_id = a.get("user_id")
        c_id = a.get("company_id")
        
        # Correct company_id if it matches user_id (the known bug)
        if u_id == c_id:
            actual_company_id = user_company_resolved.get(u_id)
            if actual_company_id:
                a["company_id"] = actual_company_id
                corrected_count += 1
            else:
                # If we couldn't resolve, default to the first company or None
                first_company = tgt_db.companies.find_one()
                if first_company:
                    a["company_id"] = first_company["_id"]
                    corrected_count += 1
                    
        if "flags" not in a:
            a["flags"] = []
        if "is_auto_closed" not in a:
            a["is_auto_closed"] = False
            
        tgt_db.attendance.insert_one(a)
    print(f"Migrated {len(attendance_records)} attendance records (corrected {corrected_count} company_id fields).")
    
    # 6. Migrate Notifications
    print("\n--- Migrating Notifications ---")
    notifications = list(src_db.notifications.find())
    for n in notifications:
        n["chat_group_id"] = None
        tgt_db.notifications.insert_one(n)
    print(f"Migrated {len(notifications)} notifications.")
    
    # 7. Migrate Activity Logs
    print("\n--- Migrating Activity Logs ---")
    activity_logs = list(src_db.activity_logs.find())
    for log in activity_logs:
        tgt_db.activity_logs.insert_one(log)
    print(f"Migrated {len(activity_logs)} activity logs.")
    
    # 8. Migrate Holidays
    print("\n--- Migrating Holidays ---")
    holidays = list(src_db.holidays.find())
    for h in holidays:
        tgt_db.holidays.insert_one(h)
    print(f"Migrated {len(holidays)} holidays.")
    
    print("\n==========================================")
    print("[SUCCESS] Data Migration completed successfully!")
    print(f"Source Database: {SOURCE_DB_NAME}")
    print(f"Target Database: {TARGET_DB_NAME}")
    print("==========================================")

if __name__ == "__main__":
    migrate()
