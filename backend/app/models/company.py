"""
Company model for MongoDB companies collection.
"""
from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional, List


class Company(Document):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    work_days: list[str] = Field(default=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    work_start_time: str = Field(default="09:00")
    work_end_time: str = Field(default="18:00")
    work_type: str = Field(default="fixed") # "fixed" or "flexible"
    flexible_hours: Optional[int] = Field(default=8)
    cut_out_time: str = Field(default="10:00")
    # Geofence settings
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    geofence_radius_meters: int = Field(default=500)  # Default 500m radius
    geofence_policy: str = Field(default="flexible")  # "strict" = block, "flexible" = flag, "disabled" = skip
    # Attendance policy
    min_session_minutes: int = Field(default=30)  # Minimum session before checkout allowed
    auto_checkout_enabled: bool = Field(default=True)
    location_drift_threshold_km: float = Field(default=5.0)  # Max drift before flagging
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "companies"
        indexes = ["name"]

