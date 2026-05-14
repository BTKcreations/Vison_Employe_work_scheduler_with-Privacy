"""
FastAPI application entry point. Updated with Global Search.
Employee Task & Reward Management System
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.connection import init_db
from app.routes import auth, employees, tasks, dashboard, reports, companies, attendance, search, holidays, notifications


import asyncio
from app.services import recurrence_service

async def run_periodic_tasks():
    """Background loop for recurring tasks."""
    while True:
        try:
            await recurrence_service.process_recurrence()
        except Exception as e:
            print(f"Error in background task: {e}")
        await asyncio.sleep(3600) # Check every hour

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - initialize DB and background tasks."""
    await init_db()
    bg_task = asyncio.create_task(run_periodic_tasks())
    yield
    bg_task.cancel()


app = FastAPI(
    title="Employee Task & Reward Management System",
    description="API for managing employees, tasks, productivity tracking, and rewards",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(tasks.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(companies.router)
app.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
app.include_router(holidays.router, prefix="/holidays", tags=["Holiday Management"])
app.include_router(search.router)
app.include_router(notifications.router)

@app.get("/", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": "Employee Task & Reward Management System",
        "version": "1.0.0",
    }