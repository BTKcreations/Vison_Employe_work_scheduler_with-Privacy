"""
Task request/response schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class RemarkEntry(BaseModel):
    user_id: str
    user_name: str
    text: str
    timestamp: str


class RecurrenceRuleSchema(BaseModel):
    type: str  # daily, weekly, monthly
    interval: int = 1
    weekdays: Optional[List[int]] = None
    month_day: Optional[int] = None
    end_type: str = "never"  # never, count, date
    end_value: Optional[str] = None

class CreateTaskRequest(BaseModel):
    work_description: str = Field(..., min_length=1, max_length=2000)
    assigned_to: Optional[str] = None  # Single employee
    assigned_to_list: Optional[List[str]] = None  # Multiple employees
    priority: str = Field(default="medium", pattern="^(regular|medium|high|critical)$")
    deadline: datetime
    company_id: Optional[str] = None  # Single company
    company_id_list: Optional[List[str]] = None  # Multiple companies
    for_all: bool = False
    is_recurrent: bool = False
    recurrence: Optional[RecurrenceRuleSchema] = None


class UpdateTaskRequest(BaseModel):
    work_description: Optional[str] = Field(None, min_length=1, max_length=2000)
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|overdue|completed_late)$")
    priority: Optional[str] = Field(None, pattern="^(regular|medium|high|critical)$")
    deadline: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=1000)  # New remark text to append


class TaskResponse(BaseModel):
    id: str
    work_description: str
    assigned_to: str
    assigned_to_name: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    status: str
    priority: str
    task_type: str
    deadline: str
    completed_at: Optional[str]
    reward_given: bool
    reward_points: int = 0
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    remarks: List[RemarkEntry] = []
    created_at: str

    @classmethod
    def from_task(cls, task, assigned_name: str = None, creator_name: str = None, company_name: str = None) -> "TaskResponse":
        return cls(
            id=str(task.id),
            work_description=task.work_description,
            assigned_to=str(task.assigned_to),
            assigned_to_name=assigned_name or task.assigned_to_name,
            created_by=str(task.created_by),
            created_by_name=creator_name or task.created_by_name,
            status=task.status.value,
            priority=task.priority.value,
            task_type=task.task_type.value,
            deadline=task.deadline.isoformat() + 'Z',
            completed_at=(task.completed_at.isoformat() + 'Z') if task.completed_at else None,
            reward_given=task.reward_given,
            reward_points=task.reward_points,
            company_id=str(task.company_id) if task.company_id else None,
            company_name=company_name or task.company_name or "Personal / Internal",
            remarks=[RemarkEntry(**r) for r in (task.remarks or [])],
            created_at=task.created_at.isoformat() + 'Z',
        )
