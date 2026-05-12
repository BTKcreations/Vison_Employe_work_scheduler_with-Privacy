from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional, List
from beanie import PydanticObjectId
from enum import Enum

class RecurrenceType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class RecurrenceEndType(str, Enum):
    NEVER = "never"
    COUNT = "count"
    DATE = "date"

class RecurrenceRule(Document):
    # This acts as a template for tasks
    work_description: str
    priority: str = "medium"
    reward_points: int = 0
    assigned_to_list: List[PydanticObjectId] = []
    company_id_list: List[PydanticObjectId] = []
    created_by: PydanticObjectId
    
    # Recurrence rules
    type: RecurrenceType
    interval: int = 1  # every 1 day/week/month
    weekdays: Optional[List[int]] = None  # 0-6 (Mon-Sun)
    month_day: Optional[int] = None
    
    end_type: RecurrenceEndType = RecurrenceEndType.NEVER
    end_value: Optional[str] = None  # count or iso date
    
    # Tracking
    next_run: datetime
    last_run: Optional[datetime] = None
    occurrence_count: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "recurring_tasks"
