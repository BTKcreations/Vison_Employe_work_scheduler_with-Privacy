"""
Migration script to rename 'title' to 'work_description' in MongoDB.
"""
import asyncio
from pymongo import AsyncMongoClient
from app.config import settings
from app.models.task import Task
from app.models.user import User
from app.models.company import Company
from beanie import init_beanie

async def migrate():
    print("Starting migration...")
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    
    # Run raw mongo command to rename field first
    print("Renaming fields in MongoDB via raw command...")
    await db["tasks"].update_many(
        {"title": {"$exists": True}},
        {"$rename": {"title": "work_description"}}
    )
    
    await init_beanie(
        database=db,
        document_models=[Task, User, Company]
    )
    
    # Populate helper fields for existing tasks
    print("Populating helper fields for reports...")
    tasks = await Task.find_all().to_list()
    for task in tasks:
        updates = {}
        
        # Resolve Assigned Name
        if not task.assigned_to_name:
            user = await User.get(task.assigned_to)
            if user:
                updates["assigned_to_name"] = user.name
        
        # Resolve Creator Name
        if not task.created_by_name:
            creator = await User.get(task.created_by)
            if creator:
                updates["created_by_name"] = creator.name
        
        # Resolve Company Name
        if task.company_id and not task.company_name:
            company = await Company.get(task.company_id)
            if company:
                updates["company_name"] = company.name
        
        if updates:
            await task.set(updates)
            
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
