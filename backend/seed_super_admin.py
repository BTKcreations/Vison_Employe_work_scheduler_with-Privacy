"""
Seed script to create the Super Admin user.
Run: python seed_super_admin.py
"""
import asyncio
from pymongo import AsyncMongoClient
from beanie import init_beanie
from app.config import settings
from app.models.user import User, UserRole
from app.auth.password import hash_password


async def seed_super_admin():
    """Create the initial Super Admin user if not exists."""
    client = AsyncMongoClient(settings.MONGODB_URL)
    database = client[settings.DATABASE_NAME]
    await init_beanie(database=database, document_models=[User])

    super_admin_email = "superadmin@system.com"
    super_admin_password = "SuperAdmin@123"

    existing = await User.find_one(User.email == super_admin_email)
    if existing:
        # Check if the role is correct, if not update it
        if existing.role != UserRole.SUPER_ADMIN:
            existing.role = UserRole.SUPER_ADMIN
            await existing.save()
            print(f"[OK] Existing user {super_admin_email} updated to SUPER_ADMIN role.")
        else:
            print(f"[OK] Super Admin user already exists: {super_admin_email}")
        return

    super_admin = User(
        name="Super Admin",
        email=super_admin_email,
        password_hash=hash_password(super_admin_password),
        role=UserRole.SUPER_ADMIN,
        company_id=None,
    )
    await super_admin.insert()
    print(f"[OK] Super Admin user created successfully!")
    print(f"   Email: {super_admin_email}")
    print(f"   Password: {super_admin_password}")
    print(f"   [!] Change the password after first login!")


if __name__ == "__main__":
    asyncio.run(seed_super_admin())
