import asyncio
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

async def test_conn():
    url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    print(f"Connecting to {url}...")
    try:
        client = MongoClient(url, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("Pinged your deployment. You successfully connected to MongoDB!")
    except Exception as e:
        print(e)

if __name__ == "__main__":
    asyncio.run(test_conn())
