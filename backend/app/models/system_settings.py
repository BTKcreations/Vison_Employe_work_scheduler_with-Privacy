"""
System Settings model for Admin configurations.
"""
from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Dict, Optional

class SystemSettings(Document):
    # Singleton ID
    singleton_id: Optional[str] = Field(default=None)
    company_id: Optional[PydanticObjectId] = None

    # Task Priorities
    priority_points: Dict[str, float] = Field(default_factory=lambda: {
        "critical": 10.0,
        "high": 5.0,
        "medium": 3.0,
        "regular": 1.0
    })
    
    # Delay Reductions
    delay_reductions: Dict[str, float] = Field(default_factory=lambda: {
        "0": 1.0,     # On time: 100%
        "1": 0.75,    # 1 Day Late: 75%
        "2": 0.50,    # 2 Days Late: 50%
        "3": 0.25,    # 3 Days Late: 25%
        "4": 0.0      # 4+ Days Late: 0%
    })
    
    # Early Bonus
    early_completion_bonus: float = Field(default=1.1)  # 110%
    
    # Quality Modifiers
    quality_modifiers: Dict[str, float] = Field(default_factory=lambda: {
        "rework": 0.8,
        "standard": 1.0,
        "exemplary": 1.2
    })
    
    # Complexity Multipliers
    complexity_multipliers: Dict[str, float] = Field(default_factory=lambda: {
        "low": 0.8,
        "medium": 1.0,
        "high": 1.5
    })

    # Attendance Impact
    attendance_impact: Dict[str, float] = Field(default_factory=lambda: {
        "present": 1.0,
        "late_under_30": 0.75,
        "late_over_30": 0.50,
        "excused": 0.0,
        "unexcused": -1.0,
        "overtime": 1.25
    })

    # Incentive Tiers
    incentive_tiers: Dict[str, float] = Field(default_factory=lambda: {
        "0": 0.0,    # Below 40% -> 0
        "40": 0.20,  # 40-49% -> 20%
        "50": 0.35,  # 50-59% -> 35%
        "60": 0.50,  # 60-69% -> 50%
        "70": 0.75,  # 70-79% -> 75%
        "80": 1.00,  # 80-89% -> 100%
        "90": 1.50   # 90%+ -> 150% (Special Bonus)
    })

    negative_incentive_threshold: int = Field(default=5)
    negative_incentive_deduction: float = Field(default=0.05)
    attendance_bonus_threshold: float = Field(default=0.95)
    attendance_bonus_percentage: float = Field(default=0.05)

    class Settings:
        name = "system_settings"
        indexes = ["singleton_id", "company_id"]
