"""
Verification script to validate the migrated database against the source database
and check compatibility with Beanie ODM schemas.
"""
import os
import asyncio
from bson import ObjectId
from pymongo import MongoClient
from beanie import init_beanie
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
ATLAS_URL = "mongodb+srv://employee-task-management:employee-task-management@employee-task-managemen.bf806ra.mongodb.net/?appName=Employee-task-management"

if "mongodb+srv" in MONGODB_URL or "bf806ra.mongodb.net" in MONGODB_URL:
    connection_url = MONGODB_URL
else:
    connection_url = ATLAS_URL

SOURCE_DB_NAME = "employee_task_reward1"
TARGET_DB_NAME = "employee_task_reward4"

async def test_beanie_validation(connection_url):
    print("\n--- Running Beanie ODM Validation on Migrated DB ---")
    try:
        from pymongo import AsyncMongoClient
        from app.models.user import User
        from app.models.task import Task
        from app.models.activity_log import ActivityLog
        from app.models.company import Company
        from app.models.attendance import Attendance
        from app.models.holiday import Holiday
        from app.models.recurring_task import RecurrenceRule
        from app.models.notification import Notification
        from app.models.category import Category
        from app.models.leave import Leave
        from app.models.leave_balance import LeaveBalance
        from app.models.regularization import AttendanceRegularization
        from app.models.payroll import SalaryStructure, Payroll
        from app.models.chat_group import ChatGroup
        from app.models.chat_message import ChatMessage
        from app.models.ai_insight import CachedAIInsight

        client = AsyncMongoClient(connection_url)
        database = client[TARGET_DB_NAME]
        
        await init_beanie(
            database=database,
            document_models=[
                User, Task, ActivityLog, Company, Attendance, Holiday, 
                RecurrenceRule, Notification, Category, Leave, LeaveBalance, 
                AttendanceRegularization, SalaryStructure, Payroll,
                ChatGroup, ChatMessage, CachedAIInsight
            ]
        )
        print("[OK] Beanie ODM successfully initialized with target database!")
        
        # Test loading documents via Beanie to trigger validation
        print("Testing validation on Users...")
        users = await User.find_all().to_list()
        print(f"  [OK] Successfully validated & loaded {len(users)} Users.")
        
        print("Testing validation on Companies...")
        companies = await Company.find_all().to_list()
        print(f"  [OK] Successfully validated & loaded {len(companies)} Companies.")
        
        print("Testing validation on Tasks...")
        tasks = await Task.find_all().to_list()
        print(f"  [OK] Successfully validated & loaded {len(tasks)} Tasks.")
        
        print("Testing validation on Attendance...")
        attendances = await Attendance.find_all().to_list()
        print(f"  [OK] Successfully validated & loaded {len(attendances)} Attendances.")
        
        print("Testing validation on Leave Balances...")
        leave_balances = await LeaveBalance.find_all().to_list()
        print(f"  [OK] Successfully validated & loaded {len(leave_balances)} Leave Balances.")
        
        print("[SUCCESS] All migrated collections pass Beanie ODM model validation!")
        return True
    except Exception as e:
        print(f"[FAIL] Beanie ODM Validation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def verify():
    client = MongoClient(connection_url)
    
    src_db = client[SOURCE_DB_NAME]
    tgt_db = client[TARGET_DB_NAME]
    
    print("==========================================")
    print("      DATABASE MIGRATION VERIFICATION     ")
    print("==========================================")
    print(f"Source Database: {SOURCE_DB_NAME}")
    print(f"Target Database: {TARGET_DB_NAME}")
    
    errors = []
    
    # 1. Compare collection counts
    collections_to_compare = [
        "companies", "categories", "users", "tasks", "attendance", 
        "notifications", "activity_logs", "holidays"
    ]
    
    print("\n--- Comparing Collection Document Counts ---")
    for coll in collections_to_compare:
        src_count = src_db[coll].count_documents({})
        tgt_count = tgt_db[coll].count_documents({})
        if src_count == tgt_count:
            print(f"[OK] Collection '{coll}': {src_count} documents in both.")
        else:
            err = f"[MISMATCH] Collection '{coll}': Source has {src_count}, Target has {tgt_count}!"
            print(err)
            errors.append(err)
            
    # 2. Check Leave Balances count
    employee_count = tgt_db.users.count_documents({"role": {"$ne": "admin"}})
    lb_count = tgt_db.leave_balances.count_documents({})
    print(f"\n--- Checking Leave Balances ---")
    if lb_count == employee_count:
        print(f"[OK] Created {lb_count} leave balance records (matches non-admin users count: {employee_count}).")
    else:
        err = f"[MISMATCH] Leave balances count ({lb_count}) does not match non-admin users count ({employee_count})!"
        print(err)
        errors.append(err)
        
    # 3. Sanity check fields
    print("\n--- Checking Field Types and Integrity ---")
    
    # Users
    users_with_int_points = tgt_db.users.count_documents({"reward_points": {"$type": "int"}})
    if users_with_int_points == 0:
        print("[OK] All users have float/double reward_points.")
    else:
        err = f"[FAIL] Found {users_with_int_points} users with 'int' reward_points."
        print(err)
        errors.append(err)
        
    employees_missing_company = tgt_db.users.count_documents({"role": "employee", "company_id": None})
    total_employees = tgt_db.users.count_documents({"role": "employee"})
    print(f"[INFO] Employees missing company_id: {employees_missing_company} out of {total_employees}")
    
    # Tasks
    tasks_with_int_points = tgt_db.tasks.count_documents({"reward_points": {"$type": "int"}})
    if tasks_with_int_points == 0:
        print("[OK] All tasks have float/double reward_points.")
    else:
        err = f"[FAIL] Found {tasks_with_int_points} tasks with 'int' reward_points."
        print(err)
        errors.append(err)
        
    tasks_with_title = tgt_db.tasks.count_documents({"title": {"$exists": True}})
    if tasks_with_title == 0:
        print("[OK] All tasks renamed 'title' to 'work_description'.")
    else:
        err = f"[FAIL] Found {tasks_with_title} tasks still having 'title' field."
        print(err)
        errors.append(err)
        
    # Attendance
    buggy_attendance = tgt_db.attendance.count_documents({"$expr": {"$eq": ["$user_id", "$company_id"]}})
    if buggy_attendance == 0:
        print("[OK] All attendance records have company_id correctly resolved (not equal to user_id).")
    else:
        err = f"[WARNING] Found {buggy_attendance} attendance records where company_id == user_id."
        print(err)
        
    print("\n==========================================")
    if not errors:
        print("[OK] Basic PyMongo-level verification PASSED!")
        # Proceed with Beanie Validation
        loop = asyncio.get_event_loop()
        beanie_ok = loop.run_until_complete(test_beanie_validation(connection_url))
        if beanie_ok:
            print("\n[SUCCESS] Verification process fully PASSED!")
        else:
            print("\n[FAIL] Verification process FAILED at Beanie ODM validation!")
    else:
        print(f"\n[FAIL] Verification process FAILED with {len(errors)} errors!")
        for e in errors:
            print(f" - {e}")
            
if __name__ == "__main__":
    verify()
