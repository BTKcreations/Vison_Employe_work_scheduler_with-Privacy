import asyncio
import time
from collections import defaultdict

class MockQuery:
    def __init__(self, count_val):
        self.count_val = count_val

    async def count(self):
        # Simulate network and DB time for count
        await asyncio.sleep(0.005)
        return self.count_val

class MockTask:
    assigned_to = "assigned_to"
    status = "status"
    @classmethod
    def find(cls, *args, **kwargs):
        # Mock task find
        return MockQuery(10)

class MockEmp:
    def __init__(self, id_val):
        self.id = id_val
        self.name = f"Emp {id_val}"
        self.email = f"emp{id_val}@test.com"
        self.is_active = True
        self.reward_points = 0
        from datetime import datetime, timezone
        self.created_at = datetime.now(timezone.utc)

async def simulate_employees_excel_unoptimized():
    employees = [MockEmp(i) for i in range(1000)]

    rows = []
    for emp in employees:
        total_tasks = await MockTask.find(MockTask.assigned_to == emp.id).count()
        completed_tasks = await MockTask.find(MockTask.assigned_to == emp.id, MockTask.status == "completed").count()

        rows.append({
            "Employee ID": str(emp.id),
            "Name": emp.name,
            "Total Tasks": total_tasks,
            "Completed Tasks": completed_tasks,
        })
    return rows

async def simulate_employees_excel_optimized():
    employees = [MockEmp(i) for i in range(1000)]
    emp_ids = [emp.id for emp in employees]

    # Simulate single query fetching
    await asyncio.sleep(0.05)

    # Mock aggregation result
    task_counts = {emp.id: {"total": 10, "completed": 10} for emp in employees}

    rows = []
    for emp in employees:
        counts = task_counts.get(emp.id, {"total": 0, "completed": 0})
        total_tasks = counts["total"]
        completed_tasks = counts["completed"]

        rows.append({
            "Employee ID": str(emp.id),
            "Name": emp.name,
            "Total Tasks": total_tasks,
            "Completed Tasks": completed_tasks,
        })
    return rows


async def run_benchmark():
    start_time = time.time()
    await simulate_employees_excel_unoptimized()
    end_time = time.time()
    duration_unoptimized = end_time - start_time
    print(f"simulate_employees_excel (unoptimized) took {duration_unoptimized:.4f} seconds")

    start_time = time.time()
    await simulate_employees_excel_optimized()
    end_time = time.time()
    duration_optimized = end_time - start_time
    print(f"simulate_employees_excel (optimized) took {duration_optimized:.4f} seconds")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
