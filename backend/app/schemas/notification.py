from pydantic import BaseModel, Field
from datetime import datetime
from beanie import PydanticObjectId
from typing import Optional, List

class NotificationBase(BaseModel):
    title: str
    message: str
    type: str

class NotificationCreate(NotificationBase):
    user_id: PydanticObjectId
    sender_id: Optional[PydanticObjectId] = None

class NotificationResponse(NotificationBase):
    id: PydanticObjectId = Field(alias="_id")
    user_id: PydanticObjectId
    sender_id: Optional[PydanticObjectId]
    is_read: bool
    created_at: datetime

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "title": "New Task Assigned",
                "message": "You have been assigned a new task.",
                "type": "task_assigned",
                "is_read": False,
                "created_at": "2024-05-14T12:00:00"
            }
        }

class NotificationList(BaseModel):
    items: List[NotificationResponse]
    unread_count: int
