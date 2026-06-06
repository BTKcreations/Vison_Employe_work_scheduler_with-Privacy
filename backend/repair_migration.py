import asyncio
import sys
from datetime import datetime
from typing import Any
from pymongo import AsyncMongoClient, ASCENDING
from pymongo.errors import OperationFailure
from app.config import settings

DATA_COLLECTIONS_WITH_TENANT_FK = [
    "users",
    "business_units",
    "tasks",
    "attendance",
    "leaves",
    "leave_balances",
    "leave_balance_audits",
    "leave_ledger",
    "payrolls",
    "payroll_history",
    "salary_structures",
    "regularizations",
    "categories",
    "chat_groups",
    "chat_messages",
    "chat_messages_ws",
    "activity_logs",
    "ai_insights",
    "audit_events",
    "holidays",
    "ledger",
    "recurring_tasks",
    "notifications",
    "rewards",
    "leaderboard_cache",
    "task_counters",
    "ai_report_runs",
    "platform_audit_logs",
]

async def rename_field_in_collection(db, coll: str, old: str, new: str) -> int:
    """Rename a field across all docs in a collection. Returns the count renamed."""
    if coll not in await db.list_collection_names():
        return 0
    res = await db[coll].update_many({old: {"$exists": True}}, {"$rename": {old: new}})
    return res.modified_count

async def main():
    print("== Repairing Tenant/Company/BU database migration ==")
    print(f"   MONGODB_URL: {settings.MONGODB_URL}")
    print(f"   DATABASE_NAME: {settings.DATABASE_NAME}")

    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    collections = await db.list_collection_names()
    print(f"   Collections present: {collections}")

    # Step 1: Handle empty tenants collection and rename companies -> tenants
    if "tenants" in collections:
        tenant_count = await db["tenants"].count_documents({})
        if tenant_count == 0:
            print("[1] 'tenants' collection exists but is empty. Dropping it to allow rename.")
            await db["tenants"].drop()
            collections = await db.list_collection_names()
        else:
            print("[1] 'tenants' collection exists and contains documents. Skipping drop.")

    if "tenants" not in collections and "companies" in collections:
        print("[1] Renaming companies -> tenants")
        await db["companies"].rename("tenants")
        collections = await db.list_collection_names()
    else:
        print("[1] Skipping rename: either tenants collection already has docs or no companies collection exists")

    # Step 2: Create default company for each tenant
    tenant_to_default_company = {}
    if "tenants" in collections:
        tenants = await db["tenants"].find().to_list(length=None)
        print(f"[2] Found {len(tenants)} tenants. Creating/checking default companies...")
        for t in tenants:
            tid = t["_id"]
            tname = t.get("name") or "Tenant"
            existing = await db["companies"].find_one({"tenant_id": tid})
            if existing:
                tenant_to_default_company[tid] = existing["_id"]
                print(f"    Tenant '{tname}': default company already exists: {existing['_id']}")
                continue
            doc = {
                "name": f"{tname} Main",
                "description": "Default company created by migration.",
                "tenant_id": tid,
                "is_active": True,
                "created_by": None,
                "created_at": datetime.utcnow(),
            }
            ins = await db["companies"].insert_one(doc)
            tenant_to_default_company[tid] = ins.inserted_id
            print(f"    Tenant '{tname}': created default company {ins.inserted_id}")
    else:
        print("[2] Skipping: tenants collection not present.")

    # Step 3: Rename company_id -> tenant_id on data collections
    print("[3] Renaming company_id -> tenant_id on data collections")
    for coll in DATA_COLLECTIONS_WITH_TENANT_FK:
        if coll not in collections:
            continue
        if coll == "business_units":
            continue
        n = await rename_field_in_collection(db, coll, "company_id", "tenant_id")
        if n:
            print(f"    {coll}: {n} docs renamed")

    # Step 4: Wire business units
    print("[4] Wiring business units: tenant_id + new company_id")
    if "business_units" in collections:
        bus = await db["business_units"].find().to_list(length=None)
        for bu in bus:
            old_company_id = bu.get("company_id")
            tid = bu.get("tenant_id") or old_company_id
            new_company_id = tenant_to_default_company.get(tid)
            if new_company_id is None:
                # If no company, fall back to first available default company if exists
                if tenant_to_default_company:
                    new_company_id = list(tenant_to_default_company.values())[0]
            
            if new_company_id is not None:
                if "company_id" in bu and "tenant_id" not in bu:
                    await db["business_units"].update_one(
                        {"_id": bu["_id"]},
                        {"$rename": {"company_id": "tenant_id"}},
                    )
                await db["business_units"].update_one(
                    {"_id": bu["_id"]},
                    {"$set": {"company_id": new_company_id}},
                )
        print(f"    Processed {len(bus)} business units")

    # Step 5: Wire users
    print("[5] Wiring users: primary_company_id + scope_company_ids + tenant_id")
    if "users" in collections:
        users = await db["users"].find().to_list(length=None)
        for u in users:
            old_company_id = u.get("company_id")
            tid = u.get("tenant_id") or old_company_id
            # Fall back to first available tenant if tid is None
            if tid is None and tenant_to_default_company:
                tid = list(tenant_to_default_company.keys())[0]
            
            new_company_id = tenant_to_default_company.get(tid)
            updates = {}
            if "tenant_id" not in u or u["tenant_id"] is None:
                updates["tenant_id"] = tid
            if "primary_company_id" not in u and new_company_id is not None:
                updates["primary_company_id"] = new_company_id
            if "scope_company_ids" not in u:
                updates["scope_company_ids"] = []
            
            if updates:
                await db["users"].update_one({"_id": u["_id"]}, {"$set": updates})
        print(f"    Processed {len(users)} users")

    # Step 6: Create indexes on companies
    print("[6] Ensuring indexes on new companies collection")
    try:
        await db["companies"].create_index([("tenant_id", ASCENDING), ("name", ASCENDING)], unique=True)
        await db["companies"].create_index([("tenant_id", ASCENDING), ("is_active", ASCENDING)])
        print("    Indexes created successfully")
    except OperationFailure as e:
        print(f"    Indexes already exist or error: {e}")

    # Verify results
    print("\n== Migration Verification Summary ==")
    collections_after = await db.list_collection_names()
    if "tenants" in collections_after:
        n_tenants = await db["tenants"].count_documents({})
        print(f"   tenants: {n_tenants}")
    if "companies" in collections_after:
        n_companies = await db["companies"].count_documents({})
        print(f"   companies (new): {n_companies}")
    if "users" in collections_after:
        users_with_tenant = await db["users"].count_documents({"tenant_id": {"$ne": None}})
        print(f"   users with tenant_id: {users_with_tenant}")
    
    # Check attendance records
    if "attendance" in collections_after:
        missing_tenant_in_attendance = await db["attendance"].count_documents({"tenant_id": {"$exists": False}})
        print(f"   attendance records missing tenant_id: {missing_tenant_in_attendance}")
        if missing_tenant_in_attendance > 0 and tenant_to_default_company:
            default_tenant = list(tenant_to_default_company.keys())[0]
            print(f"   Fixing {missing_tenant_in_attendance} attendance records with default tenant_id {default_tenant}")
            await db["attendance"].update_many({"tenant_id": {"$exists": False}}, {"$set": {"tenant_id": default_tenant}})
            missing_tenant_in_attendance = await db["attendance"].count_documents({"tenant_id": {"$exists": False}})
            print(f"   attendance records missing tenant_id after fix: {missing_tenant_in_attendance}")

if __name__ == "__main__":
    asyncio.run(main())
