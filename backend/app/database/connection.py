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


async def init_db():
    """Initialize MongoDB connection and Beanie ODM."""
    client = AsyncMongoClient(settings.MONGODB_URL)
    database = client[settings.DATABASE_NAME]

    await init_beanie(
        database=database,
        document_models=[User, Task, ActivityLog, Company]
    )

    print(f"[OK] Connected to MongoDB: {settings.DATABASE_NAME}")
