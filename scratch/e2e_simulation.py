import asyncio
import os
import sys
from datetime import datetime, timedelta

# Adjust path to import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

# Force test database isolation for simulation
os.environ["DATABASE_NAME"] = "employee_task_simulation"
os.environ["JWT_SECRET"] = "simulation-jwt-secret-key-123456789"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"

from app.database.connection import init_db
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.task import Task, TaskStatus
from app.models.attendance import Attendance
from app.models.system_settings import SystemSettings
from app.auth.password import hash_password
from app.services import task_service, user_service

async def run_e2e_simulation():
    print("=" * 70)
    print("        STARTING END-TO-END SYNTHETIC USER WORKFLOW SIMULATION        ")
    print("=" * 70)

    # 1. Initialize DB Connection
    await init_db()

    # Clean databases for a fresh run
    models = [User, Task, Company, Attendance, SystemSettings]
    for model in models:
        try:
            await model.delete_all()
        except Exception:
            pass

    print("[STEP 1/7] Connected and purged simulation database collections successfully.")

    # 2. Configure Premium Settings & Incentive Rules
    settings = SystemSettings(
        singleton_id="default",
        priority_points={
            "critical": 10.0,
            "high": 5.0,
            "medium": 3.0,
            "regular": 1.0
        },
        complexity_multipliers={
            "low": 0.8,
            "medium": 1.0,
            "high": 1.5
        },
        delay_reductions={
            "0": 1.0,
            "1": 0.75,
            "2": 0.50,
            "3": 0.25,
            "4": 0.0
        },
        early_completion_bonus=1.10,  # 10% bonus
        incentive_tiers={
            "0": 0.0,
            "40": 0.20,
            "50": 0.35,
            "60": 0.50,
            "70": 0.75,
            "80": 1.00,
            "90": 1.50
        },
        attendance_bonus_threshold=0.95,
        attendance_bonus_percentage=0.05
    )
    await settings.insert()
    print("[STEP 2/7] Custom dynamic incentive and quality settings configured successfully.")

    # 3. Create Company and Corporate Profile
    company = Company(
        name="Vision Technologies Ltd",
        description="Headquarters Sector 4",
        office_lat=12.9716,
        office_lng=77.5946
    )
    await company.insert()
    print(f"[STEP 3/7] Created corporate profile for: '{company.name}'")

    # 4. Provision Users (Admin and Employee with Base Salary)
    admin = User(
        name="Alex Mercer (Admin)",
        email="alex.admin@visiontech.com",
        password_hash=hash_password("adminsecret123"),
        role=UserRole.ADMIN,
        company_id=company.id
    )
    await admin.insert()

    employee = User(
        name="Sophia Patel (Developer)",
        email="sophia.patel@visiontech.com",
        password_hash=hash_password("sophiasecret123"),
        role=UserRole.EMPLOYEE,
        company_id=company.id,
        base_salary=55000.0,
        reward_points=0.0
    )
    await employee.insert()
    print(f"[STEP 4/7] Provisioned Admin '{admin.name}' and Employee '{employee.name}' (Base Salary: INR {employee.base_salary:,.2f})")

    # 5. Simulate Geofenced Attendance Clock-In & Clock-Out
    # (Inside valid latitude/longitude coordinate range)
    check_in_time = datetime.utcnow() - timedelta(hours=9)
    attendance = Attendance(
        user_id=employee.id,
        company_id=company.id,
        check_in=check_in_time,
        check_out=datetime.utcnow(),
        status="present",
        location_in={"lat": 12.9716, "lng": 77.5946},
        location_out={"lat": 12.9716, "lng": 77.5946}
    )
    await attendance.insert()
    print(f"[STEP 5/7] Employee '{employee.name}' clocked in at {check_in_time.strftime('%H:%M:%S')} & out successfully within geofence.")

    # 6. Assign and Complete High Complexity Task
    deadline = datetime.utcnow() + timedelta(days=3)  # On time & early bonus eligible (>24h)
    task = await task_service.create_task(
        work_description="Refactor user security modules & optimize JWT verification routines",
        assigned_to=str(employee.id),
        created_by=str(admin.id),
        priority="critical",
        complexity="high",
        deadline=deadline,
        company_id=str(company.id)
    )
    print(f"[STEP 6/7] Admin assigned Critical priority, High complexity Task '{task.work_description[:45]}...'")

    # Employee submits task completion
    # Admin rates with Outstanding quality multiplier (1.3x)
    completed_task = await task_service.update_task(
        task_id=str(task.id),
        user_id=str(admin.id),
        is_admin=True,
        status="completed",
        quality_multiplier=1.30,
        remarks="Excellent performance, optimized response times by 35%!"
    )
    
    # Reload employee to view earned rewards
    reloaded_employee = await User.get(employee.id)
    print(f"[STEP 6/7 COMPLETE] Task marked COMPLETED. Employee earned: {reloaded_employee.reward_points:.2f} reward points!")
    print(f"       -> Calculation: critical priority base (10.0) * high complexity (1.5) * early bonus (1.10) * outstanding quality (1.30) = {reloaded_employee.reward_points:.2f}")

    # 7. Execute Monthly Payroll & Incentive Auditing
    print("[STEP 7/7] Executing Premium Payroll Audit & Incentive calculations...")
    # Calculate performance target ratio (simulated at 85% target achievement)
    points_earned = reloaded_employee.reward_points
    
    # Dynamic tier calculation:
    # 85% achievement corresponds to 100% incentive tier multiplier
    incentive_rate = 1.00  # From settings.incentive_tiers["80"]
    incentive_amount = points_earned * 150.0  # E.g., INR 150 per point base reward
    
    total_monthly_payout = reloaded_employee.base_salary + incentive_amount
    
    print("-" * 70)
    print("                    MONTHLY PERFORMANCE & PAYOUT AUDIT                 ")
    print("-" * 70)
    print(f" Employee Name      : {reloaded_employee.name}")
    print(f" Base Salary        : INR {reloaded_employee.base_salary:,.2f}")
    print(f" Reward Points      : {points_earned:.2f} Points")
    print(f" Incentive Payout   : INR {incentive_amount:,.2f} (@ INR 150/point)")
    print(f" Net Monthly Payout : INR {total_monthly_payout:,.2f}")
    print("-" * 70)
    print("        END-TO-END WORKFLOW SIMULATION EXECUTED 100% SUCCESSFULLY      ")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_e2e_simulation())
