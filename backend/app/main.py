"""
FastAPI application entry point.
Employee Task & Reward Management System
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.connection import init_db
from app.routes import auth, employees, tasks, dashboard, reports, companies


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - initialize DB on startup."""
    await init_db()
    yield


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


@app.get("/", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": "Employee Task & Reward Management System",
        "version": "1.0.0",
    }
