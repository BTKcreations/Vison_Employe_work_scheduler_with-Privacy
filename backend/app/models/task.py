"""
Task model for MongoDB tasks collection.
"""
from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional, List
from beanie import PydanticObjectId


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskType(str, Enum):
    ASSIGNED = "assigned"
    PERSONAL = "personal"


class Task(Document):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    assigned_to: PydanticObjectId
    created_by: PydanticObjectId
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    task_type: TaskType = TaskType.ASSIGNED
    deadline: datetime
    completed_at: Optional[datetime] = None
    reward_given: bool = False
    company_id: Optional[PydanticObjectId] = None
    remarks: List[dict] = Field(default_factory=list)  # [{"user_id": str, "user_name": str, "text": str, "timestamp": str}]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "tasks"
        indexes = ["assigned_to", "created_by", "status", "deadline", "company_id"]

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Prepare Weekly Report",
                "description": "Complete the weekly status report",
                "status": "pending",
                "priority": "high",
                "task_type": "assigned",
                "deadline": "2024-12-31T17:00:00",
            }
        }
