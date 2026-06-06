"""
Backfill tenant fields on existing companies.

Run once after deploying the SaaS model. Sets tenant_status='active' and
unlimited max_employees for every existing company that has no tenant_status
yet, so existing tenants keep working as before.
"""
import asyncio
from datetime import datetime
from pymongo import AsyncMongoClient
from beanie import init_beanie

from app.config import settings
from app.models.company import Company, TENANT_STATUS_ACTIVE


async def migrate():
    client = AsyncMongoClient(settings.MONGODB_URL)
    database = client[settings.DATABASE_NAME]
    await init_beanie(database=database, document_models=[Company])

    companies = await Company.find().to_list()
    updated = 0
    for c in companies:
        changed = False
        if not c.tenant_status:
            c.tenant_status = TENANT_STATUS_ACTIVE
            changed = True
        if c.max_employees is None or c.max_employees == 0:
            c.max_employees = 10000
            changed = True
        if not c.activated_at:
            c.activated_at = c.created_at or datetime.utcnow()
            changed = True
        if changed:
            await c.save()
            updated += 1

    print(f"[OK] Migrated {updated}/{len(companies)} companies to the tenant model")


if __name__ == "__main__":
    asyncio.run(migrate())
