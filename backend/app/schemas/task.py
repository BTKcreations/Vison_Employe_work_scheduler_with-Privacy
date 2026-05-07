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


class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    assigned_to: Optional[str] = None  # Employee ID; None = personal task
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    deadline: datetime
    company_id: Optional[str] = None  # Company ID


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|overdue)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    deadline: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=1000)  # New remark text to append


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
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
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    remarks: List[RemarkEntry] = []
    created_at: str

    @classmethod
    def from_task(cls, task, assigned_name: str = None, creator_name: str = None, company_name: str = None) -> "TaskResponse":
        return cls(
            id=str(task.id),
            title=task.title,
            description=task.description,
            assigned_to=str(task.assigned_to),
            assigned_to_name=assigned_name,
            created_by=str(task.created_by),
            created_by_name=creator_name,
            status=task.status.value,
            priority=task.priority.value,
            task_type=task.task_type.value,
            deadline=task.deadline.isoformat() + 'Z',
            completed_at=(task.completed_at.isoformat() + 'Z') if task.completed_at else None,
            reward_given=task.reward_given,
            company_id=str(task.company_id) if task.company_id else None,
            company_name=company_name,
            remarks=[RemarkEntry(**r) for r in (task.remarks or [])],
            created_at=task.created_at.isoformat() + 'Z',
        )
