"""
MongoDB connection setup using PyMongo Async and Beanie ODM.
"""
from pymongo import AsyncMongoClient
from beanie import init_beanie
from app.config import settings
from app.models.user import User
from app.models.task import Task
from app.models.activity_log import ActivityLog
from app.models.company import Company
from app.models.attendance import Attendance
from app.models.holiday import Holiday
from app.models.recurring_task import RecurrenceRule
from app.models.notification import Notification
from app.models.category import Category


async def init_db():
    """Initialize MongoDB connection and Beanie ODM."""
    try:
        # Set a 5-second timeout for server selection to prevent hanging on Render
        client = AsyncMongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
        database = client[settings.DATABASE_NAME]

        await init_beanie(
            database=database,
            document_models=[User, Task, ActivityLog, Company, Attendance, Holiday, RecurrenceRule, Notification, Category]
        )
        print(f"[OK] Connected to MongoDB: {settings.DATABASE_NAME}")
    except Exception as e:
        print(f"[ERROR] Failed to connect to MongoDB: {str(e)}")
        # Raise the error to prevent the app from starting in a broken state.
        # This will cause the container/process to restart, which is often 
        # preferred in production (fail-fast).
        raise e
