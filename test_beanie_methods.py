import asyncio
from app.models.user import User
from beanie import Document

async def main():
    print(f"User has get_pymongo_collection: {hasattr(User, 'get_pymongo_collection')}")
    print(f"User has get_motor_collection: {hasattr(User, 'get_motor_collection')}")

if __name__ == "__main__":
    asyncio.run(main())
