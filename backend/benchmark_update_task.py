import asyncio
import time
import os
os.environ["DATABASE_NAME"] = "employee_task_test_benchmark"
os.environ["JWT_SECRET"] = "test-jwt-secret-key-for-vision-work-scheduler-123456789"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"

from app.database.connection import init_db
from app.models.category import Category
from app.models.task import Task
from app.models.user import User
from app.main import app

async def benchmark():
    await init_db()
    await Category.delete_all()
    await Task.delete_all()
    await User.delete_all()

    # Create dummy user
    user = User(
        email="test@example.com",
        name="Test",
        hashed_password="pw",
        role="employee",
        is_active=True
    )
    await user.insert()

    # Create 50 dummy categories
    category_ids = []
    for i in range(50):
        cat = Category(name=f"Cat {i}")
        await cat.insert()
        category_ids.append(cat.id)

    task = Task(
        work_description="Test task",
        assigned_to=user.id,
        created_by=user.id,
        category_ids=category_ids,
        priority="low",
        complexity="low",
        task_type="assigned",
        status="pending"
    )
    await task.insert()

    # Benchmark original
    start = time.perf_counter()
    cat_names = []
    for cid in (task.category_ids or []):
        cat = await Category.get(cid)
        if cat:
            cat_names.append(cat.name)
    end = time.perf_counter()
    original_time = end - start

    # Benchmark optimized
    start = time.perf_counter()
    cat_names_opt = []
    if task.category_ids:
        categories = await Category.find({"_id": {"$in": task.category_ids}}).to_list()
        # To maintain order if necessary, but typically name list order doesn't matter or we can sort/map
        cat_map = {c.id: c.name for c in categories}
        cat_names_opt = [cat_map[cid] for cid in task.category_ids if cid in cat_map]
    end = time.perf_counter()
    opt_time = end - start

    print(f"Original time: {original_time:.5f}s")
    print(f"Optimized time: {opt_time:.5f}s")
    print(f"Improvement: {original_time / opt_time:.2f}x")

if __name__ == "__main__":
    asyncio.run(benchmark())
