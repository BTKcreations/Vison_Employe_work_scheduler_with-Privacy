import asyncio
import time
from app.database.connection import init_db
from app.models.user import User, UserRole
from app.services.dashboard_service import get_admin_dashboard
from beanie import PydanticObjectId

async def run_benchmark():
    # Initialize DB using the app's own connection logic
    await init_db()

    # Find an admin user
    admin = await User.find_one(User.role == UserRole.ADMIN)
    if not admin:
        # Create one if not exists for benchmarking
        admin = User(
            name="Bench Admin",
            email="admin@bench.com",
            password_hash="hash",
            role=UserRole.ADMIN,
            tenant_id=PydanticObjectId()
        )
        await admin.insert()

    print(f"Running benchmark for admin: {admin.email}")

    # Warm up
    await get_admin_dashboard(admin)

    start = time.perf_counter()
    iterations = 5
    for _ in range(iterations):
        await get_admin_dashboard(admin)
    end = time.perf_counter()

    avg_time = (end - start) / iterations
    print(f"Average get_admin_dashboard time: {avg_time:.4f} seconds")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
