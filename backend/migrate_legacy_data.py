"""
Migration script to map all legacy/past data in MongoDB
to the tenant admin 'admin@company.com' and their company.
Run: python migrate_legacy_data.py
"""
import asyncio
from pymongo import AsyncMongoClient
from beanie import init_beanie, PydanticObjectId
from app.config import settings
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.task import Task
from app.models.attendance import Attendance


async def run_migration():
    """Migrate all legacy data to belong to admin@company.com and their company."""
    print("Connecting to database...")
    client = AsyncMongoClient(settings.MONGODB_URL)
    database = client[settings.DATABASE_NAME]

    # Initialize beanie
    await init_beanie(
        database=database,
        document_models=[User, Company, Task, Attendance]
    )

    # 1. Find the target tenant admin
    target_admin_email = "admin@company.com"
    admin = await User.find_one(User.email == target_admin_email)
    if not admin:
        print(f"[ERROR] Tenant Admin user '{target_admin_email}' not found.")
        print("Please ensure this user exists in the database first.")
        return

    print(f"[OK] Found Tenant Admin: {admin.name} ({admin.email}) ID: {admin.id}")

    # 2. Find or create a company to assign everything to
    target_company = None
    
    # Check if the admin is already mapped to a company
    if admin.company_id:
        target_company = await Company.get(admin.company_id)
        if target_company:
            print(f"[OK] Admin is already associated with company: {target_company.name} ID: {target_company.id}")

    # If no valid company is mapped, look for existing companies owned by this admin
    if not target_company:
        target_company = await Company.find_one(Company.owner_id == admin.id)
        if target_company:
            print(f"[OK] Found company owned by admin: {target_company.name} ID: {target_company.id}")

    # If still no company, take the first company in the system and assign it to the admin
    if not target_company:
        target_company = await Company.find_one()
        if target_company:
            target_company.owner_id = admin.id
            await target_company.save()
            print(f"[OK] Re-assigned existing company '{target_company.name}' (ID: {target_company.id}) to Admin.")

    # If there are absolutely no companies in the system, create a default one
    if not target_company:
        target_company = Company(
            name="Default Corporate Company",
            description="Default organization company for tenant admin",
            owner_id=admin.id,
            is_active=True,
            work_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            work_start_time="09:00",
            work_end_time="18:00",
            work_type="fixed",
            flexible_hours=8,
            cut_out_time="10:00",
            office_lat=28.6139,
            office_lng=77.2090,
            geofence_radius_meters=500,
            geofence_policy="flexible",
            min_session_minutes=30,
            auto_checkout_enabled=True,
            location_drift_threshold_km=5.0
        )
        await target_company.insert()
        print(f"[OK] Created a new company: {target_company.name} ID: {target_company.id}")

    target_company_id = target_company.id

    # 3. Ensure the Tenant Admin is mapped to this company
    if admin.company_id != target_company_id:
        admin.company_id = target_company_id
        await admin.save()
        print(f"[OK] Linked Admin '{admin.email}' to company ID: {target_company_id}")

    # 4. Migrate all other users to this company if they don't have one
    users_to_migrate = await User.find(
        User.role != UserRole.SUPER_ADMIN,
        User.role != UserRole.ADMIN,
        User.company_id == None
    ).to_list()

    users_updated = 0
    for u in users_to_migrate:
        u.company_id = target_company_id
        await u.save()
        users_updated += 1

    print(f"[OK] Migrated {users_updated} employees/managers to Company '{target_company.name}'")

    # 5. Migrate all tasks to this company if they don't have one
    tasks_to_migrate = await Task.find(
        Task.company_id == None
    ).to_list()

    tasks_updated = 0
    for t in tasks_to_migrate:
        t.company_id = target_company_id
        t.company_name = target_company.name
        await t.save()
        tasks_updated += 1

    print(f"[OK] Migrated {tasks_updated} tasks to Company '{target_company.name}'")

    # 6. Migrate all attendance logs to this company if they have None or mismatched/missing company_id
    # Beanie finds documents with missing fields via dict lookup or find()
    attendance_to_migrate = await Attendance.find(
        {"company_id": None}
    ).to_list()

    attendance_updated = 0
    for att in attendance_to_migrate:
        att.company_id = target_company_id
        await att.save()
        attendance_updated += 1

    print(f"[OK] Migrated {attendance_updated} attendance logs to Company '{target_company.name}'")
    print("\n[COMPLETE] Migration ran successfully. All legacy data is now scoped to the tenant admin.")


if __name__ == "__main__":
    asyncio.run(run_migration())
