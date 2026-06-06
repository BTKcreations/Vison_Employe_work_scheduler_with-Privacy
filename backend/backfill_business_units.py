"""
Backfill business units for existing tenants.

For every Company (tenant) in the database, ensure there is at least one
BusinessUnit of type HQ named "Head Office". Existing data already
references `company_id` (the tenant) so it stays valid. Existing users
without a business_unit_id get pinned to that tenant's HQ unit. Existing
categories / leaves / etc. that lack business_unit_id remain tenant-wide
(None) and are still visible in queries (which filter on company_id).
"""
import asyncio
from datetime import datetime
from app.database.connection import init_db
from app.models.company import Company
from app.models.user import User
from app.models.business_unit import BusinessUnit, BUSINESS_UNIT_TYPE_HQ


async def main():
    await init_db()

    tenants = await Company.find_all().to_list()
    print(f"[INFO] Found {len(tenants)} tenants.")

    hq_created = 0
    users_pinned = 0
    for tenant in tenants:
        existing_hq = await BusinessUnit.find_one(
            BusinessUnit.company_id == tenant.id,
            BusinessUnit.is_default == True,
        )
        if not existing_hq:
            existing_hq = await BusinessUnit.find_one(
                BusinessUnit.company_id == tenant.id,
                BusinessUnit.type == BUSINESS_UNIT_TYPE_HQ,
            )
        if not existing_hq:
            existing_hq = BusinessUnit(
                name="Head Office",
                type=BUSINESS_UNIT_TYPE_HQ,
                code="HQ",
                company_id=tenant.id,
                description="Default HQ unit created by backfill.",
                is_active=True,
                is_default=True,
                work_days=tenant.work_days,
                work_start_time=tenant.work_start_time,
                work_end_time=tenant.work_end_time,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            await existing_hq.insert()
            hq_created += 1
            print(f"  [+] Created HQ for tenant {tenant.name} ({tenant.id})")
        else:
            if not existing_hq.is_default:
                await existing_hq.update({"$set": {"is_default": True}})
            print(f"  [.] Tenant {tenant.name} already has HQ ({existing_hq.id})")

        unpinned = await User.find(
            User.company_id == tenant.id,
            User.business_unit_id == None,
            User.is_platform_owner == False,
        ).to_list()
        for u in unpinned:
            await u.update({"$set": {"business_unit_id": existing_hq.id}})
            users_pinned += 1
        if unpinned:
            print(f"     pinned {len(unpinned)} users to HQ unit")

    print(f"[DONE] Created {hq_created} HQ unit(s); pinned {users_pinned} user(s).")


if __name__ == "__main__":
    asyncio.run(main())
