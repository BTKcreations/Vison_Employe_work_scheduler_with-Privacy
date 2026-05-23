"""
Leaves management routes - apply, view, approve/reject with role-based hierarchy.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.auth.dependencies import get_current_user, has_permission
from app.models.user import User, UserRole
from app.models.leave import Leave, LeaveType, LeaveStatus, LEAVE_LIMITS
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.schemas.leave import (
    LeaveCreate, LeaveUpdateStatus, LeaveResponse,
    LeaveBalanceResponse, LeaveBalanceItem,
)
from beanie import PydanticObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/leaves", tags=["Leave Management"])


# ─── Helpers ────────────────────────────────────────────────────────────

async def _get_subordinate_ids(current_user: User) -> list[PydanticObjectId]:
    """Return a list of user IDs that the current user can manage leaves for."""
    from beanie.operators import In, Or
    from app.models.role import BaseArchetype

    arch = current_user.role_archetype or current_user.role

    if arch in [BaseArchetype.SUPER_ADMIN, BaseArchetype.ADMIN, BaseArchetype.HR, BaseArchetype.FINANCE, BaseArchetype.AUDITOR, UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        # Admin / HR / Finance / Auditor sees all users in their company
        if current_user.company_id:
            users = await User.find(
                User.company_id == current_user.company_id,
                User.role_archetype != BaseArchetype.SUPER_ADMIN,
                User.role != UserRole.SUPER_ADMIN,
            ).to_list()
        else:
            # Super admin with no company — see all non-super-admin
            users = await User.find(
                User.role_archetype != BaseArchetype.SUPER_ADMIN,
                User.role != UserRole.SUPER_ADMIN
            ).to_list()
        return [u.id for u in users]

    if arch == BaseArchetype.MANAGER or arch == UserRole.MANAGER:
        # Direct reports + employees reporting to this manager's assistant managers
        asms = await User.find(
            Or(
                User.role_archetype == BaseArchetype.ASSISTANT_MANAGER,
                User.role == UserRole.ASSISTANT_MANAGER
            ),
            User.parent_id == current_user.id,
        ).to_list()
        asm_ids = [a.id for a in asms]

        direct = await User.find(
            User.parent_id == current_user.id,
        ).to_list()

        indirect = []
        if asm_ids:
            indirect = await User.find(
                Or(
                    User.role_archetype == BaseArchetype.EMPLOYEE,
                    User.role_archetype == BaseArchetype.CONTRACTOR,
                    User.role == UserRole.EMPLOYEE
                ),
                In(User.parent_id, asm_ids),
            ).to_list()

        all_sub_ids = {u.id for u in direct} | {u.id for u in indirect}
        return list(all_sub_ids)

    if arch == BaseArchetype.ASSISTANT_MANAGER or arch == UserRole.ASSISTANT_MANAGER:
        # Only direct subordinates
        subs = await User.find(
            Or(
                User.role_archetype == BaseArchetype.EMPLOYEE,
                User.role_archetype == BaseArchetype.CONTRACTOR,
                User.role == UserRole.EMPLOYEE
            ),
            User.parent_id == current_user.id,
        ).to_list()
        return [u.id for u in subs]

    return []



async def _can_review_leave(reviewer: User, leave: Leave) -> bool:
    """Check if reviewer is authorised to approve/reject this leave."""
    from app.auth.dependencies import has_permission

    # If they can manage global policies, they can review any leave in their company
    if await has_permission(reviewer, "leaves:manage_policies"):
        if reviewer.company_id and leave.company_id:
            return reviewer.company_id == leave.company_id
        return True

    # Otherwise check if they can approve team leaves, and employee is in their subtree
    if await has_permission(reviewer, "leaves:approve_team"):
        sub_ids = await _get_subordinate_ids(reviewer)
        return leave.user_id in sub_ids

    return False



async def _compute_used_days(user_id: PydanticObjectId, leave_type: LeaveType, year: int) -> int:
    """Count the total approved leave days of a given type in a calendar year."""
    start_of_year = datetime(year, 1, 1)
    end_of_year = datetime(year, 12, 31, 23, 59, 59)

    leaves = await Leave.find(
        Leave.user_id == user_id,
        Leave.leave_type == leave_type,
        Leave.status == LeaveStatus.APPROVED,
        Leave.start_date >= start_of_year,
        Leave.end_date <= end_of_year,
    ).to_list()

    total_days = 0
    for lv in leaves:
        total_days += (lv.end_date - lv.start_date).days + 1
    return total_days


async def _compute_pending_days(user_id: PydanticObjectId, leave_type: LeaveType, year: int) -> int:
    """Count total pending leave days of a given type in a calendar year."""
    start_of_year = datetime(year, 1, 1)
    end_of_year = datetime(year, 12, 31, 23, 59, 59)

    leaves = await Leave.find(
        Leave.user_id == user_id,
        Leave.leave_type == leave_type,
        Leave.status == LeaveStatus.PENDING,
        Leave.start_date >= start_of_year,
        Leave.end_date <= end_of_year,
    ).to_list()

    total_days = 0
    for lv in leaves:
        total_days += (lv.end_date - lv.start_date).days + 1
    return total_days


def _resolve_user_names(users: list[User]) -> dict[PydanticObjectId, str]:
    """Build a lookup dict from user list."""
    return {u.id: u.name for u in users}


# ─── Routes ─────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def apply_leave(
    request: LeaveCreate,
    current_user: User = Depends(get_current_user),
):
    """Apply for a leave. Any authenticated user can apply."""
    if not await has_permission(current_user, "leaves:apply"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to apply for leaves",
        )

    # Validate leave_type
    try:
        leave_type = LeaveType(request.leave_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid leave type: {request.leave_type}. Must be one of: sick, casual, paid, unpaid",
        )

    # Validate dates
    start = request.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = request.end_date.replace(hour=0, minute=0, second=0, microsecond=0)

    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be on or before end date",
        )

    duration = (end - start).days + 1

    # Check for overlapping leaves (approved or pending)
    overlapping = await Leave.find(
        Leave.user_id == current_user.id,
        Leave.status != LeaveStatus.REJECTED,
        Leave.start_date <= end,
        Leave.end_date >= start,
    ).to_list()

    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an approved or pending leave overlapping with these dates",
        )

    # Check balance for limited leave types
    limit = LEAVE_LIMITS.get(leave_type)
    if limit is not None:
        year = start.year
        used = await _compute_used_days(current_user.id, leave_type, year)
        pending = await _compute_pending_days(current_user.id, leave_type, year)
        remaining = limit - used - pending
        if duration > remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient {leave_type.value} leave balance. "
                       f"Allowed: {limit}, Used: {used}, Pending: {pending}, "
                       f"Available: {remaining}, Requested: {duration}. "
                       f"Consider applying for unpaid leave instead.",
            )

    # Create leave record
    leave = Leave(
        user_id=current_user.id,
        company_id=current_user.company_id,
        leave_type=leave_type,
        start_date=start,
        end_date=end,
        reason=request.reason,
    )
    await leave.insert()

    # Notify the user's parent (manager/admin) if present
    if current_user.parent_id:
        await Notification(
            user_id=current_user.parent_id,
            sender_id=current_user.id,
            title="New Leave Request",
            message=f"{current_user.name} has applied for {leave_type.value} leave from "
                    f"{start.strftime('%d %b %Y')} to {end.strftime('%d %b %Y')} ({duration} day{'s' if duration > 1 else ''}).",
            type="leave_applied",
        ).insert()

    # Activity log
    await ActivityLog(
        user_id=current_user.id,
        action="leave_applied",
        details=f"Applied for {leave_type.value} leave: {start.strftime('%d %b %Y')} - {end.strftime('%d %b %Y')} ({duration} days)",
    ).insert()

    return LeaveResponse.from_leave(leave, user_name=current_user.name)


@router.get("/me")
async def get_my_leaves(
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """Get all leaves for the current user, optionally filtered by status."""
    query = {"user_id": current_user.id}
    if status_filter:
        try:
            LeaveStatus(status_filter)
            query["status"] = status_filter
        except ValueError:
            pass

    leaves = await Leave.find(query).sort("-created_at").to_list()

    # Resolve reviewer names
    reviewer_ids = {lv.reviewed_by for lv in leaves if lv.reviewed_by}
    reviewer_names = {}
    if reviewer_ids:
        from beanie.operators import In
        reviewers = await User.find(In(User.id, list(reviewer_ids))).to_list()
        reviewer_names = _resolve_user_names(reviewers)

    return [
        LeaveResponse.from_leave(
            lv,
            user_name=current_user.name,
            reviewer_name=reviewer_names.get(lv.reviewed_by),
        )
        for lv in leaves
    ]


@router.get("/balances")
async def get_my_balances(
    current_user: User = Depends(get_current_user),
):
    """Get dynamic leave balances for the current year."""
    year = datetime.utcnow().year
    balances = []

    for lt in LeaveType:
        used = await _compute_used_days(current_user.id, lt, year)
        limit = LEAVE_LIMITS.get(lt)
        balances.append(LeaveBalanceItem(
            leave_type=lt.value,
            allowed=limit,
            used=used,
            remaining=(limit - used) if limit is not None else None,
        ))

    return LeaveBalanceResponse(year=year, balances=balances)


@router.get("/subordinates")
async def get_subordinate_leaves(
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """Get leaves of subordinates based on hierarchy."""
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees cannot view subordinate leaves",
        )

    sub_ids = await _get_subordinate_ids(current_user)
    if not sub_ids:
        return []

    from beanie.operators import In
    query = {"user_id": {"$in": sub_ids}}
    if status_filter:
        try:
            LeaveStatus(status_filter)
            query["status"] = status_filter
        except ValueError:
            pass

    leaves = await Leave.find(query).sort("-created_at").to_list()

    # Resolve user names and reviewer names in bulk
    all_user_ids = {lv.user_id for lv in leaves} | {lv.reviewed_by for lv in leaves if lv.reviewed_by}
    all_users = await User.find(In(User.id, list(all_user_ids))).to_list() if all_user_ids else []
    name_map = _resolve_user_names(all_users)

    return [
        LeaveResponse.from_leave(
            lv,
            user_name=name_map.get(lv.user_id),
            reviewer_name=name_map.get(lv.reviewed_by) if lv.reviewed_by else None,
        )
        for lv in leaves
    ]


@router.patch("/{leave_id}/status")
async def update_leave_status(
    leave_id: str,
    request: LeaveUpdateStatus,
    current_user: User = Depends(get_current_user),
):
    """Approve or reject a leave request (management only)."""
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees cannot approve or reject leaves",
        )

    # Validate status value
    try:
        new_status = LeaveStatus(request.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {request.status}. Must be 'approved' or 'rejected'",
        )

    if new_status == LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set status back to pending",
        )

    # Get the leave
    try:
        leave = await Leave.get(PydanticObjectId(leave_id))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Leave request has already been {leave.status.value}",
        )

    # Verify hierarchy
    if not await _can_review_leave(current_user, leave):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorised to review this leave request",
        )

    # If approving, re-check balance to prevent double-approval exceeding limits
    if new_status == LeaveStatus.APPROVED:
        limit = LEAVE_LIMITS.get(leave.leave_type)
        if limit is not None:
            year = leave.start_date.year
            used = await _compute_used_days(leave.user_id, leave.leave_type, year)
            duration = (leave.end_date - leave.start_date).days + 1
            if used + duration > limit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Approving this leave would exceed the {leave.leave_type.value} leave limit "
                           f"({limit} days). Currently used: {used}, requested: {duration}.",
                )

    # Update the leave
    now = datetime.utcnow()
    update_data = {
        "status": new_status,
        "reviewed_by": current_user.id,
        "reviewed_at": now,
        "updated_at": now,
    }
    if new_status == LeaveStatus.REJECTED and request.rejection_reason:
        update_data["rejection_reason"] = request.rejection_reason

    await leave.set(update_data)

    # Reload leave
    leave = await Leave.get(leave.id)

    # Notify the employee
    employee = await User.get(leave.user_id)
    employee_name = employee.name if employee else "Unknown"

    status_text = "approved ✅" if new_status == LeaveStatus.APPROVED else "rejected ❌"
    message = f"Your {leave.leave_type.value} leave request ({leave.start_date.strftime('%d %b %Y')} - {leave.end_date.strftime('%d %b %Y')}) has been {status_text} by {current_user.name}."
    if new_status == LeaveStatus.REJECTED and request.rejection_reason:
        message += f" Reason: {request.rejection_reason}"

    await Notification(
        user_id=leave.user_id,
        sender_id=current_user.id,
        title=f"Leave {new_status.value.capitalize()}",
        message=message,
        type=f"leave_{new_status.value}",
    ).insert()

    # Activity log
    await ActivityLog(
        user_id=current_user.id,
        action=f"leave_{new_status.value}",
        details=f"{new_status.value.capitalize()} {leave.leave_type.value} leave for {employee_name} "
                f"({leave.start_date.strftime('%d %b %Y')} - {leave.end_date.strftime('%d %b %Y')})",
    ).insert()

    return LeaveResponse.from_leave(
        leave,
        user_name=employee_name,
        reviewer_name=current_user.name,
    )


@router.delete("/{leave_id}")
async def cancel_leave(
    leave_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel a pending leave request (only the applicant can cancel)."""
    try:
        leave = await Leave.get(PydanticObjectId(leave_id))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own leave requests",
        )

    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a leave that has already been {leave.status.value}",
        )

    await leave.delete()

    await ActivityLog(
        user_id=current_user.id,
        action="leave_cancelled",
        details=f"Cancelled {leave.leave_type.value} leave: {leave.start_date.strftime('%d %b %Y')} - {leave.end_date.strftime('%d %b %Y')}",
    ).insert()

    return {"message": "Leave request cancelled successfully"}
