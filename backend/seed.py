"""
Seed script to create initial admin user.
Run: python seed.py
"""
import asyncio
from pymongo import AsyncMongoClient
from beanie import init_beanie
from app.config import settings
from app.models.user import User, UserRole
from app.auth.password import hash_password


async def seed_admin():
    """Create the initial admin user if not exists."""
    client = AsyncMongoClient(settings.MONGODB_URL)
    database = client[settings.DATABASE_NAME]
    await init_beanie(database=database, document_models=[User])

    admin_email = "admin@company.com"
    admin_password = "Admin@123"

    existing = await User.find_one(User.email == admin_email)
    if existing:
        print(f"[OK] Admin user already exists: {admin_email}")
        return

    admin = User(
        name="System Admin",
        email=admin_email,
        password_hash=hash_password(admin_password),
        role=UserRole.ADMIN,
    )
    await admin.insert()
    print(f"[OK] Admin user created successfully!")
    print(f"   Email: {admin_email}")
    print(f"   Password: {admin_password}")
    print(f"   [!] Change the password after first login!")


if __name__ == "__main__":
    asyncio.run(seed_admin())
