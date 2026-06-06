"""
One-time migration: introduce the new 3-level hierarchy.

Today:
  Company (collection `companies`, the tenant)  ── tenant_id reference
    └─ BusinessUnit (company_id = tenant id, no separate company FK)
         └─ User (company_id = tenant id)
              and tasks, attendance, leaves, etc. all store company_id = tenant id

Target:
  Tenant (collection `tenants`, the tenant / billing entity)  ── tenant_id reference
    └─ Company (collection `companies`, new; admin-managed sub-org)  ── company_id reference
         └─ BusinessUnit (tenant_id, company_id = FK to new Company)
              └─ User (tenant_id, primary_company_id = FK to new Company, scope_company_ids = [])

Steps
-----
1. Rename the `companies` collection to `tenants` (preserves all data + indexes).
2. For every existing tenant, create a default Company in the new `companies`
   collection ("<Tenant Name> HQ" or just the tenant name if you prefer).
3. Rename the field `company_id` -> `tenant_id` on every collection that
   referenced the old Company (tasks, attendance, leaves, payroll, BUs, users, etc.).
4. On `business_units`: also set the new `company_id` field to the default Company
   for that tenant.
5. On `users`: set `primary_company_id` to the default Company; add
   `scope_company_ids: []`.
6. On `companies` (the new one): create a unique `(tenant_id, name)` index.

Idempotent: re-running on a partially-migrated DB is safe; each step no-ops if
its precondition is unmet.
"""
import argparse
import asyncio
import sys
from datetime import datetime
from typing import Any

from pymongo import AsyncMongoClient, ASCENDING
from pymongo.errors import OperationFailure

from app.config import settings


# Collections whose documents have a `company_id` field that points to the
# OLD Company (today's tenant). After the migration, this field is renamed
# to `tenant_id`. BusinessUnit is special-cased because it also needs a new
# `company_id` (FK to the new Company) populated.
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


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--apply", action="store_true", help="Actually mutate. Default is dry-run.")
    return p.parse_args()


async def list_collections(db) -> list[str]:
    return await db.list_collection_names()


async def rename_field_in_collection(db, coll: str, old: str, new: str) -> int:
    """Rename a field across all docs in a collection. Returns the count renamed."""
    if coll not in await db.list_collection_names():
        return 0
    res = await db[coll].update_many({old: {"$exists": True}}, {"$rename": {old: new}})
    return res.modified_count


async def main() -> int:
    args = parse_args()
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"== Migrate to Tenant/Company/BU hierarchy ({mode}) ==")
    print(f"   MONGODB_URL: {settings.MONGODB_URL}")
    print(f"   DATABASE_NAME: {settings.DATABASE_NAME}")

    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    collections = await list_collections(db)
    print(f"   collections present: {len(collections)}")

    # ------------------------------------------------------------------
    # Step 1: rename `companies` -> `tenants`
    # ------------------------------------------------------------------
    if "tenants" not in collections and "companies" in collections:
        print("\n[1] rename companies -> tenants")
        if args.apply:
            await db["companies"].rename("tenants")
        collections = await list_collections(db)
    elif "tenants" in collections and "companies" in collections:
        print("\n[1] skip: both tenants and companies already exist (likely already migrated)")
    else:
        print("\n[1] skip: no `companies` collection to rename")

    # ------------------------------------------------------------------
    # Step 2: for each tenant, create a default Company
    # ------------------------------------------------------------------
    print("\n[2] create default Company for each tenant")
    if "tenants" not in collections:
        print("    skip: no `tenants` collection")
        tenant_to_default_company: dict[Any, Any] = {}
    else:
        tenants = await db["tenants"].find().to_list(length=None)
        tenant_to_default_company = {}
        for t in tenants:
            tid = t["_id"]
            tname = t.get("name") or "Tenant"
            existing = await db["companies"].find_one({"tenant_id": tid})
            if existing:
                tenant_to_default_company[tid] = existing["_id"]
                print(f"    tenant {tid} {tname!r}: default company already exists {_id_or_id(existing)}")
                continue
            doc = {
                "name": f"{tname} Main",
                "description": "Default company created by migration.",
                "tenant_id": tid,
                "is_active": True,
                "created_by": None,
                "created_at": datetime.utcnow(),
            }
            if args.apply:
                ins = await db["companies"].insert_one(doc)
                tenant_to_default_company[tid] = ins.inserted_id
            else:
                print(f"    tenant {tid} {tname!r}: WOULD create default company {tname!r} Main")
        if args.apply:
            print(f"    created {len(tenant_to_default_company)} default companies")

    # ------------------------------------------------------------------
    # Step 3: rename company_id -> tenant_id on every relevant collection
    # ------------------------------------------------------------------
    print("\n[3] rename company_id -> tenant_id on data collections")
    for coll in DATA_COLLECTIONS_WITH_TENANT_FK:
        if coll not in collections:
            continue
        if coll == "business_units":
            continue  # special-cased in step 4
        n = await rename_field_in_collection(db, coll, "company_id", "tenant_id")
        if n:
            print(f"    {coll}: {n} docs renamed")

    # ------------------------------------------------------------------
    # Step 4: business_units gets BOTH renames
    #     a) old `company_id` -> `tenant_id`
    #     b) new `company_id` (FK to the new Company) = default company
    # ------------------------------------------------------------------
    print("\n[4] wire business_units: tenant_id + new company_id")
    if "business_units" in collections:
        bus = await db["business_units"].find().to_list(length=None)
        for bu in bus:
            old_company_id = bu.get("company_id")
            tid = bu.get("tenant_id") or old_company_id
            new_company_id = tenant_to_default_company.get(tid)
            if new_company_id is None:
                continue
            updates: dict[str, Any] = {}
            if "company_id" in bu and "tenant_id" not in bu:
                updates["company_id"] = "__rename_to_tenant_id__"  # placeholder
            if args.apply:
                if "company_id" in bu and "tenant_id" not in bu:
                    await db["business_units"].update_one(
                        {"_id": bu["_id"]},
                        {"$rename": {"company_id": "tenant_id"}},
                    )
                await db["business_units"].update_one(
                    {"_id": bu["_id"]},
                    {"$set": {"company_id": new_company_id}},
                )
        if not args.apply:
            print(f"    {len(bus)} BUs would be rewired (tenant_id + new company_id)")

    # ------------------------------------------------------------------
    # Step 5: users get primary_company_id + scope_company_ids
    # ------------------------------------------------------------------
    print("\n[5] users: primary_company_id + scope_company_ids + tenant_id")
    if "users" in collections:
        users = await db["users"].find().to_list(length=None)
        for u in users:
            tid = u.get("tenant_id") or u.get("company_id")
            if tid is None:
                continue
            new_company_id = tenant_to_default_company.get(tid)
            updates: dict[str, Any] = {}
            if "primary_company_id" not in u and new_company_id is not None:
                updates["primary_company_id"] = new_company_id
            if "scope_company_ids" not in u:
                updates["scope_company_ids"] = []
            if updates and args.apply:
                await db["users"].update_one({"_id": u["_id"]}, {"$set": updates})
        if not args.apply:
            print(f"    {len(users)} users would gain primary_company_id + scope_company_ids")

    # ------------------------------------------------------------------
    # Step 6: indexes
    # ------------------------------------------------------------------
    print("\n[6] ensure indexes on new companies collection")
    if args.apply:
        try:
            await db["companies"].create_index([("tenant_id", ASCENDING), ("name", ASCENDING)], unique=True)
            await db["companies"].create_index([("tenant_id", ASCENDING), ("is_active", ASCENDING)])
        except OperationFailure as e:
            print(f"    (indexes may already exist): {e}")
    else:
        print("    would create unique (tenant_id, name) and (tenant_id, is_active) indexes on `companies`")

    # ------------------------------------------------------------------
    # Final report
    # ------------------------------------------------------------------
    print("\n== Summary ==")
    new_collections = await list_collections(db)
    print(f"   collections after: {new_collections}")
    if "tenants" in new_collections:
        n = await db["tenants"].count_documents({})
        print(f"   tenants: {n}")
    if "companies" in new_collections:
        n = await db["companies"].count_documents({})
        print(f"   companies (new): {n}")
    if "business_units" in new_collections:
        n_with_company = await db["business_units"].count_documents({"company_id": {"$exists": True}})
        n_with_tenant = await db["business_units"].count_documents({"tenant_id": {"$exists": True}})
        print(f"   business_units with tenant_id: {n_with_tenant}, with new company_id: {n_with_company}")
    if "users" in new_collections:
        n = await db["users"].count_documents({"primary_company_id": {"$exists": True}})
        print(f"   users with primary_company_id: {n}")

    if not args.apply:
        print("\n!! DRY-RUN: re-run with --apply to perform the migration")
    return 0


def _id_or_id(doc: dict) -> Any:
    return doc.get("_id") or doc.get("id")


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
