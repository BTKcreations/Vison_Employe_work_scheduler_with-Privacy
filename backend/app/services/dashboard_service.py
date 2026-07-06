"""
Dashboard service - analytics and summary data for dashboards.
"""

from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.activity_log import ActivityLog
from app.models.tenant import Tenant
from app.services.task_service import get_task_counts
from app.services.reward_service import get_leaderboard
from app.models.attendance import Attendance, ist_now, IST
from app.utils.ist_time import to_utc_iso
from beanie import PydanticObjectId
from beanie.operators import In, NE, GTE
from datetime import datetime, timedelta, timezone
from typing import Optional, List

NON_ADMIN_ROLES = [
    UserRole.HR_MANAGER,
    UserRole.ASSISTANT_HR_MANAGER,
    UserRole.MANAGER,
    UserRole.ASSISTANT_MANAGER,
    UserRole.EMPLOYEE,
]


def _build_history_entry(day, record) -> dict:
    """Build an attendance history entry dict. Module-level helper (reused across functions)."""
    # Convert day to UTC isoformat string ending in Z
    if isinstance(day, datetime):
        date_str = to_utc_iso(day)
    else:
        day_dt = datetime.combine(day, datetime.min.time()).replace(tzinfo=IST)
        date_str = to_utc_iso(day_dt)

    entry: dict = {
        "date": date_str,
        "status": "present" if record else "absent",
    }
    if record:
        entry["check_in"] = to_utc_iso(record.check_in) if record.check_in else None
        entry["check_out"] = to_utc_iso(record.check_out) if record.check_out else None
        entry["location_in"] = record.location_in
        entry["location_out"] = record.location_out
        entry["address_in"] = record.address_in
        entry["address_out"] = record.address_out
        entry["is_regularized"] = bool(
            record.remarks and "Regularized" in (record.remarks or "")
        )
    return entry


async def get_admin_dashboard(
    current_user: User,
    filter_type: str = "month",
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    visible_ids: Optional[set] = None,
    business_unit_id: Optional[PydanticObjectId] = None,
):
    """Get admin dashboard analytics data with optimized batch queries and hierarchy filtering."""
    if visible_ids is None:
        from app.services.user_service import get_visible_employee_ids

        visible_ids = await get_visible_employee_ids(current_user)

    # 1. Fetch today's attendance once to reuse across facets
    today_start = ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    att_query = {"check_in": {"$gte": today_start}, "tenant_id": current_user.tenant_id}
    if visible_ids is not None:
        att_query["user_id"] = {"$in": list(visible_ids)}
    if business_unit_id is not None:
        att_query["business_unit_id"] = business_unit_id

    present_user_ids = await Attendance.distinct("user_id", att_query)
    present_user_ids = [PydanticObjectId(uid) for uid in present_user_ids]

    # 2. Consolidate all User stats (Total, Active, Role-based) into ONE aggregation
    user_match = {"is_deleted": {"$ne": True}, "tenant_id": current_user.tenant_id}
    if visible_ids is not None:
        user_match["_id"] = {"$in": list(visible_ids)}
    if business_unit_id is not None:
        user_match["business_unit_id"] = business_unit_id

    pipeline = [
        {"$match": user_match},
        {
            "$project": {
                "role": 1,
                "is_active": 1,
                "is_present": {"$in": ["$_id", present_user_ids]},
            }
        },
        {
            "$group": {
                "_id": "$role",
                "total": {"$sum": 1},
                "active": {"$sum": {"$cond": ["$is_active", 1, 0]}},
                "present": {"$sum": {"$cond": ["$is_present", 1, 0]}},
            }
        },
    ]

    role_stats = await User.aggregate(pipeline).to_list()

    # Process role stats and derive top-level headcounts
    role_counts = {role.value: {"total": 0, "present": 0, "absent": 0} for role in UserRole}
    role_counts["total_all_inclusive"] = {"total": 0, "present": 0, "absent": 0}

    total_employees = 0
    active_employees = 0
    present_non_admin = 0

    for stat in role_stats:
        r_val = stat["_id"]
        # Aggregation keys are raw strings for Enums
        role_counts[r_val] = {
            "total": stat["total"],
            "present": stat["present"],
            "absent": stat["total"] - stat["present"],
        }
        role_counts["total_all_inclusive"]["total"] += stat["total"]
        role_counts["total_all_inclusive"]["present"] += stat["present"]
        role_counts["total_all_inclusive"]["absent"] += stat["total"] - stat["present"]

        # Track NON_ADMIN counts for the top-level dashboard metrics
        if r_val in [r.value for r in NON_ADMIN_ROLES]:
            total_employees += stat["total"]
            active_employees += stat["active"]
            present_non_admin += stat["present"]

    # 3. Consolidate Task metrics (Counts, Priority, Rewards, Performance) into ONE aggregation
    # Note: We use 'virtual overdue' logic here to avoid persistent writes during a fetch operation.
    task_base_query = {"tenant_id": current_user.tenant_id}
    if visible_ids is not None:
        task_base_query["assigned_to"] = {"$in": list(visible_ids)}
    if business_unit_id is not None:
        task_base_query["business_unit_id"] = business_unit_id

    now = datetime.now(timezone.utc)
    start_date, end_date = get_date_range_for_filter(filter_type, custom_start, custom_end)

    # Enum values for raw aggregation
    C = TaskStatus.COMPLETED.value
    CL = TaskStatus.COMPLETED_LATE.value
    O = TaskStatus.OVERDUE.value
    P = TaskStatus.PENDING.value
    IP = TaskStatus.IN_PROGRESS.value

    task_pipeline = [
        {"$match": task_base_query},
        {
            "$project": {
                "status": 1,
                "priority": 1,
                "reward_given": 1,
                "deadline": 1,
                "completed_at": 1,
                "is_overdue": {
                    "$or": [
                        {"$eq": ["$status", O]},
                        {"$and": [{"$in": ["$status", [P, IP]]}, {"$lt": ["$deadline", now]}]}
                    ]
                }
            }
        },
        {
            "$facet": {
                "status_counts": [
                    {
                        "$group": {
                            "_id": {
                                "$cond": ["$is_overdue", O, "$status"]
                            },
                            "count": {"$sum": 1}
                        }
                    }
                ],
                "priority_dist": [
                    {"$group": {"_id": "$priority", "count": {"$sum": 1}}}
                ],
                "total_rewards": [
                    {"$match": {"reward_given": True}},
                    {"$count": "count"}
                ],
                "performance": [
                    {"$match": {"deadline": {"$gte": start_date, "$lte": end_date}}},
                    {
                        "$group": {
                            "_id": None,
                            "assigned": {"$sum": 1},
                            "completed": {
                                "$sum": {
                                    "$cond": [
                                        {"$in": ["$status", [C, CL]]},
                                        1, 0
                                    ]
                                }
                            },
                            "completed_on_time": {
                                "$sum": {
                                    "$cond": [
                                        {
                                            "$and": [
                                                {"$in": ["$status", [C, CL]]},
                                                {"$lte": ["$completed_at", "$deadline"]}
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            },
                            "overdue": {
                                "$sum": {
                                    "$cond": ["$is_overdue", 1, 0]
                                }
                            },
                            "pending": {
                                "$sum": {
                                    "$cond": [
                                        {
                                            "$and": [
                                                {"$not": {"$in": ["$status", [C, CL]]}},
                                                {"$not": "$is_overdue"}
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            }
                        }
                    }
                ]
            }
        }
    ]

    task_results = await Task.aggregate(task_pipeline).to_list()
    res = task_results[0] if task_results else {}

    # Extract Task Counts
    task_counts = {"total": 0, "completed": 0, "completed_late": 0, "pending": 0, "in_progress": 0, "overdue": 0}
    for s in res.get("status_counts", []):
        status = s["_id"]
        if status in task_counts:
            task_counts[status] = s["count"]
        task_counts["total"] += s["count"]

    # Extract Priority Distribution
    priority_dist = {"critical": 0, "high": 0, "medium": 0, "regular": 0}
    for p in res.get("priority_dist", []):
        if p["_id"] in priority_dist:
            priority_dist[p["_id"]] = p["count"]

    # Extract Total Rewards
    total_rewards = res.get("total_rewards", [{}])[0].get("count", 0) if res.get("total_rewards") else 0

    # Extract Performance Metrics
    perf_data = res.get("performance", [{}])[0] if res.get("performance") else {}
    assigned = perf_data.get("assigned", 0)
    completed = perf_data.get("completed", 0)
    completed_on_time = perf_data.get("completed_on_time", 0)

    performance_tracking = {
        "assigned_tasks": assigned,
        "completed_tasks": completed,
        "pending_tasks": perf_data.get("pending", 0),
        "overdue_tasks": perf_data.get("overdue", 0),
        "productivity_pct": round((completed / assigned * 100.0), 1) if assigned > 0 else 0.0,
        "performance_score": round((completed_on_time / assigned * 100.0), 1) if assigned > 0 else 0.0,
    }

    # 4. Fetch Leaderboard (Keep separate for now as it's a different analytical query)
    if visible_ids is not None:
        leaderboard = await get_leaderboard(limit=5, user_ids=list(visible_ids), tenant_id=current_user.tenant_id)
    else:
        leaderboard = await get_leaderboard(limit=5, tenant_id=current_user.tenant_id)

    # Recent activity - optimized with batch user fetching
    if visible_ids is not None:
        recent_activities = (
            await ActivityLog.find(
                In(ActivityLog.user_id, list(visible_ids)),
                ActivityLog.tenant_id == current_user.tenant_id,
            )
            .sort("-timestamp")
            .limit(10)
            .to_list()
        )
    else:
        recent_activities = (
            await ActivityLog.find(ActivityLog.tenant_id == current_user.tenant_id)
            .sort("-timestamp")
            .limit(10)
            .to_list()
        )

    user_ids = list(set([a.user_id for a in recent_activities]))
    users = await User.find(In(User.id, user_ids), User.tenant_id == current_user.tenant_id).to_list()
    user_map = {u.id: u.name for u in users}

    activity_list = [
        {
            "id": str(a.id),
            "user_id": str(a.user_id),
            "user_name": user_map.get(a.user_id, "Unknown"),
            "action": a.action,
            "details": a.details,
            "timestamp": to_utc_iso(a.timestamp),
        }
        for a in recent_activities
    ]

    return {
        "employees": {
            "total": total_employees,
            "active": active_employees,
            "role_counts": role_counts,
        },
        "tasks": task_counts,
        "priority_distribution": priority_dist,
        "attendance_today": {
            "present": present_non_admin,
            "absent": max(0, total_employees - present_non_admin),
            "total": total_employees
        },
        "leaderboard": leaderboard,
        "recent_activity": activity_list,
        "total_rewards_given": total_rewards,
        "performance_tracking": performance_tracking,
    }


async def get_employee_dashboard(
    user_id: str,
    filter_type: str = "month",
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
):
    """Get employee personal dashboard data with optimized batch queries."""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        return None

    task_counts = await get_task_counts(user_id=user_id, tenant_id=user.tenant_id)

    # Recent activity for this employee
    recent_activities = (
        await ActivityLog.find(
            ActivityLog.user_id == PydanticObjectId(user_id),
            ActivityLog.tenant_id == user.tenant_id
        )
        .sort("-timestamp")
        .limit(10)
        .to_list()
    )

    activity_list = [
        {
            "id": str(a.id),
            "user_id": str(a.user_id),
            "user_name": user.name,
            "action": a.action,
            "details": a.details,
            "timestamp": to_utc_iso(a.timestamp),
        }
        for a in recent_activities
    ]

    # Rewards earned
    rewards_earned = await Task.find(
        Task.assigned_to == PydanticObjectId(user_id),
        Task.tenant_id == user.tenant_id,
        Task.reward_given == True,
    ).count()

    # Priority distribution - optimized with single aggregation
    priority_pipeline = [
        {"$match": {"assigned_to": PydanticObjectId(user_id), "tenant_id": user.tenant_id}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
    ]
    priority_results = await Task.aggregate(priority_pipeline).to_list()
    priority_distribution = {"critical": 0, "high": 0, "medium": 0, "regular": 0}
    for res in priority_results:
        if res["_id"] in priority_distribution:
            priority_distribution[res["_id"]] = res["count"]

    # Optimized attendance history (batch fetch last 90 days)
    today_start = ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    history_start = today_start - timedelta(days=89)

    attendance_records = await Attendance.find(
        Attendance.user_id == PydanticObjectId(user_id),
        Attendance.tenant_id == user.tenant_id,
        Attendance.check_in >= history_start,
    ).to_list()

    # Map records by date for fast lookup (take the first/most recent record per day)
    attendance_map: dict = {}
    for r in attendance_records:
        key = r.check_in.astimezone(IST).date()
        if key not in attendance_map:
            attendance_map[key] = r

    # Attendance status today
    attendance_status = "present" if today_start.date() in attendance_map else "absent"

    # Last 5 days attendance history
    attendance_history = []
    for i in range(5):
        day = today_start - timedelta(days=i)
        record = attendance_map.get(day.date())
        attendance_history.append(_build_history_entry(day, record))
    attendance_history.reverse()

    # Fetch tenant to check work days configuration dynamically
    tenant = await Tenant.get(user.tenant_id) if user.tenant_id else None
    if not tenant:
        tenant = await Tenant.find_one(Tenant.is_active == True)
    work_days_set = (
        {d.strip().lower() for d in tenant.work_days}
        if (tenant and tenant.work_days)
        else None
    )

    # Last 90 days attendance history for detailed calendar
    attendance_history_detailed = []
    for i in range(90):
        day = today_start - timedelta(days=i)
        record = attendance_map.get(day.date())
        if record:
            attendance_history_detailed.append(_build_history_entry(day, record))
        else:
            day_name_lower = day.strftime("%A").lower()
            is_workday = (
                (day_name_lower in work_days_set)
                if work_days_set is not None
                else (day.weekday() < 5)
            )
            if is_workday:
                attendance_history_detailed.append(_build_history_entry(day, None))

    # Calculate monthly task efficiency rate
    month_start = today_start.replace(day=1)
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    completed_this_month = await Task.find(
        Task.assigned_to == PydanticObjectId(user_id),
        Task.tenant_id == user.tenant_id,
        Task.completed_at >= month_start,
        Task.completed_at < month_end,
        In(
            Task.status,
            [TaskStatus.COMPLETED, TaskStatus.COMPLETED_LATE, TaskStatus.DELAYED],
        ),
    ).count()

    due_this_month = await Task.find(
        Task.assigned_to == PydanticObjectId(user_id),
        Task.tenant_id == user.tenant_id,
        Task.deadline >= month_start,
        Task.deadline < month_end,
    ).count()

    efficiency_rate = (
        round((completed_this_month / due_this_month * 100.0), 1)
        if due_this_month > 0
        else (100.0 if completed_this_month > 0 else 0.0)
    )

    return {
        "user": {
            "name": user.name,
            "email": user.email,
            "reward_points": user.reward_points,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "mobile": user.mobile,
            "alternate_mobile": user.alternate_mobile,
        },
        "tasks": task_counts,
        "priority_distribution": priority_distribution,
        "recent_activity": activity_list,
        "rewards_earned": rewards_earned,
        "attendance_status": attendance_status,
        "attendance_history": attendance_history,
        "attendance_history_detailed": attendance_history_detailed,
        "due_this_month": due_this_month,
        "efficiency_rate": efficiency_rate,
        "performance_tracking": await get_performance_metrics(
            user_ids=[PydanticObjectId(user_id)],
            start_date=get_date_range_for_filter(filter_type, custom_start, custom_end)[
                0
            ],
            end_date=get_date_range_for_filter(filter_type, custom_start, custom_end)[
                1
            ],
            tenant_id=user.tenant_id,
        ),
    }


async def get_all_attendance_summary(
    visible_employee_ids=None,
    business_unit_id: Optional[PydanticObjectId] = None,
    tenant_id: Optional[PydanticObjectId] = None,
):
    """Get last 5 days attendance summary for all employees (or a hierarchy-scoped subset)."""
    # Performance Optimization: Using raw PyMongo collection access and projections to bypass Beanie overhead.
    user_query = {}
    if tenant_id is not None:
        user_query["tenant_id"] = tenant_id

    if visible_employee_ids is not None:
        user_query["_id"] = {"$in": list(visible_employee_ids)}
    else:
        # Use .value for Enums when querying raw collection
        user_query["role"] = {"$in": [r.value for r in NON_ADMIN_ROLES]}

    if business_unit_id is not None:
        user_query["business_unit_id"] = business_unit_id

    # Use raw Motor collection for speed and bypass Pydantic validation/model creation
    user_collection = User.get_pymongo_collection()
    employees = await user_collection.find(
        user_query,
        {"_id": 1, "name": 1, "email": 1, "reward_points": 1}
    ).to_list(length=100000)

    if not employees:
        return []

    today_start = ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    five_days_ago = today_start - timedelta(days=4)

    employee_ids = [emp["_id"] for emp in employees]

    # Scoped attendance query with projection
    att_collection = Attendance.get_pymongo_collection()
    logs = await att_collection.find(
        {
            "check_in": {"$gte": five_days_ago},
            "user_id": {"$in": employee_ids}
        },
        {
            "user_id": 1, "check_in": 1, "check_out": 1,
            "location_in": 1, "location_out": 1,
            "address_in": 1, "address_out": 1, "remarks": 1
        }
    ).to_list(length=500000)

    # Pre-calculate daily ISO strings to avoid redundant to_utc_iso calls in the nested loops
    days_data = []
    for i in range(5):
        day = today_start - timedelta(days=i)
        days_data.append({
            "iso": to_utc_iso(day),
            "date_str": day.date().isoformat()
        })
    days_data.reverse()  # History is displayed in chronological order

    # Map logs by user_id and date for O(1) lookup in the main loop
    log_map: dict = {}
    for log in logs:
        uid = str(log["user_id"])
        # Ensure UTC awareness for correct IST conversion
        check_in = log.get("check_in")
        if check_in and check_in.tzinfo is None:
            log["check_in"] = check_in.replace(tzinfo=timezone.utc)

        check_out = log.get("check_out")
        if check_out and check_out.tzinfo is None:
            log["check_out"] = check_out.replace(tzinfo=timezone.utc)

        dt = log["check_in"]
        date_str = dt.astimezone(IST).date().isoformat()

        if uid not in log_map:
            log_map[uid] = {}
        if date_str not in log_map[uid]:
            log_map[uid][date_str] = log

    summary = []
    for emp in employees:
        uid_str = str(emp["_id"])
        history = []
        emp_logs = log_map.get(uid_str, {})

        for d in days_data:
            record = emp_logs.get(d["date_str"])
            entry = {
                "date": d["iso"],
                "status": "present" if record else "absent",
            }
            if record:
                # Maintain null-safety for check_in/out as required by frontend components
                entry.update({
                    "check_in": to_utc_iso(record["check_in"]) if record.get("check_in") else None,
                    "check_out": to_utc_iso(record["check_out"]) if record.get("check_out") else None,
                    "location_in": record.get("location_in"),
                    "location_out": record.get("location_out"),
                    "address_in": record.get("address_in"),
                    "address_out": record.get("address_out"),
                    "is_regularized": bool(record.get("remarks") and "Regularized" in record.get("remarks"))
                })
            history.append(entry)

        summary.append({
            "user_id": uid_str,
            "user_name": emp.get("name"),
            "user_email": emp.get("email"),
            "reward_points": emp.get("reward_points", 0),
            "history": history,
        })
    return summary


async def _get_today_attendance_stats(total_employees: int, visible_employee_ids=None, tenant_id: Optional[PydanticObjectId] = None):
    """Helper to get today's attendance stats using optimized database-level aggregation."""
    # Using IST for consistent day boundaries.
    today_start = ist_now().replace(hour=0, minute=0, second=0, microsecond=0)

    match_query = GTE(Attendance.check_in, today_start)
    if tenant_id is not None:
        match_query = {"$and": [match_query, {"tenant_id": tenant_id}]}

    if visible_employee_ids is not None:
        if isinstance(match_query, dict) and "$and" in match_query:
            match_query["$and"].append(In(Attendance.user_id, list(visible_employee_ids)))
        else:
            match_query = {
                "$and": [match_query, In(Attendance.user_id, list(visible_employee_ids))]
            }

    # Get count of unique users who checked in today
    present_count = len(await Attendance.distinct("user_id", match_query))

    absent_count = max(0, total_employees - present_count)

    return {"present": present_count, "absent": absent_count, "total": total_employees}


def get_date_range_for_filter(
    filter_type: str,
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
):
    from app.models.attendance import ist_now
    from datetime import datetime, timedelta

    now_ist = ist_now()

    if filter_type == "quarter":
        month = now_ist.month
        quarter = (month - 1) // 3 + 1
        start_month = (quarter - 1) * 3 + 1
        start_date = datetime(now_ist.year, start_month, 1)
        end_month = start_month + 2
        if end_month == 12:
            end_date = datetime(now_ist.year + 1, 1, 1) - timedelta(microseconds=1)
        else:
            end_date = datetime(now_ist.year, end_month + 1, 1) - timedelta(
                microseconds=1
            )

    elif filter_type == "year":
        start_date = datetime(now_ist.year, 1, 1)
        end_date = datetime(now_ist.year + 1, 1, 1) - timedelta(microseconds=1)

    elif filter_type == "custom" and custom_start and custom_end:
        try:
            start_date = datetime.strptime(custom_start.split("T")[0], "%Y-%m-%d")
            end_date = datetime.strptime(custom_end.split("T")[0], "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
        except Exception:
            start_date = datetime(now_ist.year, now_ist.month, 1)
            if now_ist.month == 12:
                end_date = datetime(now_ist.year + 1, 1, 1) - timedelta(microseconds=1)
            else:
                end_date = datetime(now_ist.year, now_ist.month + 1, 1) - timedelta(
                    microseconds=1
                )
    else:  # Default: month
        start_date = datetime(now_ist.year, now_ist.month, 1)
        if now_ist.month == 12:
            end_date = datetime(now_ist.year + 1, 1, 1) - timedelta(microseconds=1)
        else:
            end_date = datetime(now_ist.year, now_ist.month + 1, 1) - timedelta(
                microseconds=1
            )

    return start_date, end_date


async def get_performance_metrics(
    user_ids: Optional[List[PydanticObjectId]],
    start_date: datetime,
    end_date: datetime,
    tenant_id: Optional[PydanticObjectId] = None,
) -> dict:
    """Calculate performance metrics using a single MongoDB aggregation pipeline."""
    from app.models.task import Task, TaskStatus

    match_query = {"deadline": {"$gte": start_date, "$lte": end_date}}
    if tenant_id is not None:
        match_query["tenant_id"] = tenant_id
    if user_ids is not None:
        match_query["assigned_to"] = {"$in": user_ids}


    now = datetime.now(timezone.utc)

    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": None,
                "assigned": {"$sum": 1},
                "completed": {
                    "$sum": {
                        "$cond": [
                            {
                                "$in": [
                                    "$status",
                                    [TaskStatus.COMPLETED.value, TaskStatus.COMPLETED_LATE.value],
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
                "completed_on_time": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {
                                        "$in": [
                                            "$status",
                                            [
                                                TaskStatus.COMPLETED.value,
                                                TaskStatus.COMPLETED_LATE.value,
                                            ],
                                        ]
                                    },
                                    {"$lte": ["$completed_at", "$deadline"]},
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
                "overdue": {
                    "$sum": {
                        "$cond": [
                            {
                                "$or": [
                                    {"$eq": ["$status", TaskStatus.OVERDUE.value]},
                                    {
                                        "$and": [
                                            {
                                                "$not": {
                                                    "$in": [
                                                        "$status",
                                                        [
                                                            TaskStatus.COMPLETED.value,
                                                            TaskStatus.COMPLETED_LATE.value,
                                                        ],
                                                    ]
                                                }
                                            },
                                            {"$lt": ["$deadline", now]},
                                        ]
                                    },
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
                "pending": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {
                                        "$not": {
                                            "$in": [
                                                "$status",
                                                [
                                                    TaskStatus.COMPLETED.value,
                                                    TaskStatus.COMPLETED_LATE.value,
                                                ],
                                            ]
                                        }
                                    },
                                    {"$not": {"$eq": ["$status", TaskStatus.OVERDUE.value]}},
                                    {"$gte": ["$deadline", now]},
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        },
    ]

    results = await Task.aggregate(pipeline).to_list()
    res = (
        results[0]
        if results
        else {
            "assigned": 0,
            "completed": 0,
            "completed_on_time": 0,
            "overdue": 0,
            "pending": 0,
        }
    )

    assigned = res["assigned"]
    completed = res["completed"]
    completed_on_time = res["completed_on_time"]

    productivity_pct = round((completed / assigned * 100.0), 1) if assigned > 0 else 0.0
    performance_score = (
        round((completed_on_time / assigned * 100.0), 1) if assigned > 0 else 0.0
    )

    return {
        "assigned_tasks": assigned,
        "completed_tasks": completed,
        "pending_tasks": res["pending"],
        "overdue_tasks": res["overdue"],
        "productivity_pct": productivity_pct,
        "performance_score": performance_score,
    }
