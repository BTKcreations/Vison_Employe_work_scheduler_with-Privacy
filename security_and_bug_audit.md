# System Security and Bug Audit Report

## 1. Authorization & Privilege Escalation (Critical)
**Location:** `backend/app/services/task_service.py` -> `update_task()`

- **Vulnerability:** The service uses `**kwargs` to update the Task model directly. While it checks if the user is the assignee, it does not restrict *which* fields an employee can modify.
- **Impact:** A malicious employee can send a PUT request to the API to:
    - Change their task **Priority** from "Critical" to "Regular".
    - Extend their **Deadline** to a future date to ensure they receive a reward point.
    - Change the **Assigned To** field to move the task to another user.
- **Recommendation:** Implement a whitelist of fields that employees are allowed to update (e.g., only `status`, `remarks`, and `work_description`). All other fields should require `is_admin=True`.

## 2. Reward System Logic Flaws (Medium-High)
**Location:** `backend/app/services/reward_service.py`

- **Race Condition:** Reward points are updated via `user.set({"reward_points": user.reward_points + 1})`. This is a read-modify-write operation. If two tasks are completed simultaneously, one update may overwrite the other.
- **Atomicity Failure:** The process of updating the user's points, marking the task as rewarded, and creating an activity log is not wrapped in a transaction. A system crash between these steps will cause data inconsistency.
- **Boundary Error:** The check `task.completed_at < task.deadline` excludes tasks completed exactly at the deadline time.
- **Recommendation:** Use MongoDB's `$inc` operator for atomic increments and implement a transaction (if using a replica set) or a more robust state machine.

## 3. Recurrence Logic Bugs (Medium)
**Location:** Recurrence processing logic (Backend)

- **Month-End Crash:** Monthly recurrence that targets a specific day (e.g., 31st) will crash or fail when the current month has fewer days (e.g., February).
- **Idempotency Issue:** Lack of strict tracking for generated occurrences could lead to duplicate tasks if the recurrence processor is triggered multiple times for the same period.
- **Recommendation:** Implement a "last processed" timestamp and use a date-safe addition method (e.g., capping the day to the last day of the month).

## 4. Performance Bottlenecks (Low-Medium)
**Location:** `backend/app/services/task_service.py` -> `get_tasks()`

- **N+1 Update Problem:** The function iterates through every task returned and performs a separate `await task.set()` call to mark overdue tasks.
- **Impact:** Significant latency and database load as the number of tasks grows.
- **Recommendation:** Use a single `update_many` query to mark all overdue tasks for the user in one round-trip.

## 5. Frontend Validation Gaps (Low)
**Location:** `frontend/src/app/employee/tasks/page.tsx`

- **Constraint Issues:** Recurrence intervals and occurrence counts are not strictly validated as positive integers on the client side.
- **Date Validation:** No check to prevent selecting a past date as a deadline for new personal tasks.
- **Recommendation:** Add `step="1"` and `min="1"` to numeric inputs and implement a minimum date constraint for the deadline picker.