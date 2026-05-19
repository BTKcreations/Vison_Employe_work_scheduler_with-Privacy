from fastapi import APIRouter, Depends, HTTPException, status
from app.models.system_settings import SystemSettings
from app.models.user import User, UserRole
from app.auth.dependencies import get_current_user

from beanie import PydanticObjectId
from typing import Optional

router = APIRouter(prefix="/settings", tags=["settings"])

async def check_admin_company_access(current_user: User, company_id: PydanticObjectId):
    """Ensure the user is authorized to manage settings for this company."""
    if current_user.role == UserRole.SUPER_ADMIN:
        return True
    if current_user.role == UserRole.ADMIN:
        from app.models.company import Company
        companies = await Company.find({"$or": [{"owner_id": current_user.id}, {"_id": current_user.company_id}]}).to_list()
        co_ids = {c.id for c in companies}
        if company_id in co_ids:
            return True
    return False

@router.get("", response_model=SystemSettings)
async def get_settings(
    company_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get system settings. If company_id is provided, gets company-specific settings.
    Falls back to global default settings.
    """
    if company_id:
        c_id = PydanticObjectId(company_id)
        # Check permissions for admin roles
        if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            has_access = await check_admin_company_access(current_user, c_id)
            if not has_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access settings for this company"
                )
        else:
            # Regular employee can only read their own company settings
            if current_user.company_id != c_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access settings for this company"
                )

        settings = await SystemSettings.find_one(SystemSettings.company_id == c_id)
        if not settings:
            # Copy default settings as base
            default_settings = await SystemSettings.find_one({"singleton_id": "default"})
            if not default_settings:
                default_settings = SystemSettings()
                await default_settings.insert()
            
            # Create company-specific settings
            settings = SystemSettings(
                company_id=c_id,
                priority_points=default_settings.priority_points,
                delay_reductions=default_settings.delay_reductions,
                early_completion_bonus=default_settings.early_completion_bonus,
                quality_modifiers=default_settings.quality_modifiers,
                complexity_multipliers=default_settings.complexity_multipliers,
                attendance_impact=default_settings.attendance_impact,
                incentive_tiers=default_settings.incentive_tiers,
                negative_incentive_threshold=default_settings.negative_incentive_threshold,
                negative_incentive_deduction=default_settings.negative_incentive_deduction,
                attendance_bonus_threshold=default_settings.attendance_bonus_threshold,
                attendance_bonus_percentage=default_settings.attendance_bonus_percentage
            )
            await settings.insert()
        return settings

    # Fallback to global default
    settings = await SystemSettings.find_one({"singleton_id": "default"})
    if not settings:
        settings = SystemSettings(singleton_id="default")
        await settings.insert()
    return settings

@router.put("", response_model=SystemSettings)
async def update_settings(
    settings_update: dict,
    company_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Update system settings. If company_id is provided, updates company-specific settings.
    Admin only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update settings"
        )
    
    if company_id:
        c_id = PydanticObjectId(company_id)
        has_access = await check_admin_company_access(current_user, c_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update settings for this company"
            )
        settings = await SystemSettings.find_one(SystemSettings.company_id == c_id)
        if not settings:
            settings = SystemSettings(company_id=c_id)
            await settings.insert()
    else:
        # Only SUPER_ADMIN can update global default settings
        if current_user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admins can update global default settings"
            )
        settings = await SystemSettings.find_one({"singleton_id": "default"})
        if not settings:
            settings = SystemSettings(singleton_id="default")
            await settings.insert()
        
    # Update allowed fields
    allowed_fields = [
        "priority_points", "delay_reductions", "early_completion_bonus",
        "quality_modifiers", "complexity_multipliers", "attendance_impact",
        "incentive_tiers", "negative_incentive_threshold",
        "negative_incentive_deduction", "attendance_bonus_threshold",
        "attendance_bonus_percentage"
    ]
    
    for field in allowed_fields:
        if field in settings_update:
            setattr(settings, field, settings_update[field])
            
    await settings.save()
    return settings
