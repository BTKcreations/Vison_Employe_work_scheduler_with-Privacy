"""
BusinessUnit Pydantic schemas for request/response.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from beanie import PydanticObjectId


class BusinessUnitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(default="department")
    code: Optional[str] = Field(default=None, max_length=50)
    company_id: Optional[PydanticObjectId] = None
    description: Optional[str] = Field(default=None, max_length=500)
    address: Optional[str] = Field(default=None, max_length=500)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    timezone: Optional[str] = Field(default=None, max_length=100)
    currency: Optional[str] = Field(default=None, max_length=10)
    contact_email: Optional[str] = Field(default=None, max_length=200)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    work_days: Optional[List[str]] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    is_default: bool = False


class BusinessUnitUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    type: Optional[str] = None
    code: Optional[str] = None
    company_id: Optional[PydanticObjectId] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    work_days: Optional[List[str]] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class BusinessUnitResponse(BaseModel):
    id: str
    tenant_id: str
    company_id: str
    name: str
    type: str
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    is_default: bool
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    work_days: Optional[List[str]] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    employee_count: int = 0
    created_at: datetime
    updated_at: datetime


class BusinessUnitListResponse(BaseModel):
    items: List[BusinessUnitResponse]
    total: int
