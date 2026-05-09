import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load env from backend dir
load_dotenv(dotenv_path="backend/.env")

async def migrate_priority():
    print("Starting priority migration...")
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "employee_task_reward1")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    collection = db["tasks"]
    
    # Update all tasks with priority "low" to "regular"
    result = await collection.update_many(
        {"priority": "low"},
        {"$set": {"priority": "regular"}}
    )
    
    print(f"Migration completed. Modified {result.modified_count} tasks.")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_priority())
