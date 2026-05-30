import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
import sys

async def run():
    print("Test Mongo")

if __name__ == "__main__":
    asyncio.run(run())
