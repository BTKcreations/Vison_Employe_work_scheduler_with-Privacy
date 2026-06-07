# Root Cause Report & Implementation Fixes: Recurring Task System

## 1. Existing Recurrence Workflow
The recurring task engine uses `process_recurrence()` running periodically in the background (`app/main.py` -> `run_periodic_tasks`). It iterates over all active `RecurrenceRule` records whose `next_run` is past due. For each record, it creates `Task` entries for every assigned employee/company. Then, it schedules the next run based on `calculate_next_run`.

## 2. Problems Discovered
1. **Missing Yearly Recurrence**: The memory stated "Task recurrence supports Daily, Weekly, Monthly, Yearly, and Custom frequency types," but the Yearly type was completely missing from the backend models (`RecurrenceType`, `RecurrenceRuleSchema`), the recurrence service, and the frontend creation UIs.
2. **Monthly Date Clamping Bug**: `calculate_next_run` calculated the next month by rolling over manually. It clamped the day to the last day of the month using `min(rule_day, last_day_of_month)`, but it did not retain state reliably for consecutive months (the 31st clamping bug).
3. **Spawning Deadlock / Catch-up Bug**: If the background worker fails to run for a few days, a rule might only spawn one task and update its schedule by one interval. If a rule's `next_run` was days old, it would be slowly caught up.
4. **Idempotency Weakness**: The idempotency check relied on `Task.deadline == deadline`, but if microsecond differences crept in, duplicates could occur.

## 3. Root Causes
- Custom calendar math was used instead of a robust date arithmetic library like `python-dateutil`.
- The `Yearly` recurrence was completely omitted from Enums and validation schemas, breaking the expected behavior feature set.
- Background loops lacked catching-up mechanisms to process multiple missed periods per cycle.

## 4. Fixes Implemented
### Backend Changes
- Added `python-dateutil` to `requirements.txt`.
- Re-wrote `calculate_next_run` using `dateutil.relativedelta`. This elegantly solves month-end clamping (e.g., Jan 31 -> Feb 29 -> Mar 31) by keeping `day=rule_day` while preserving month-length safety.
- Updated `process_recurrence` loop to allow catching up to 5 missed occurrences per rule per background tick (`while rule.is_active and rule.next_run <= now and spawns < 5`).
- Stripped microseconds in the idempotency deadline constraint (`deadline = rule.next_run.replace(hour=23, minute=59, second=59, microsecond=0)`) to prevent duplicate spawned tasks on timezone/microsecond mismatches.

### Database Changes (Schemas)
- Added `YEARLY = "yearly"` to `RecurrenceType` Enum in `backend/app/models/recurring_task.py`.
- Added `"yearly"` support to `RecurrenceRuleSchema` validation.

### Frontend Changes
- Modified recurrence dropdowns in:
  - `frontend/src/app/admin/tasks/page.tsx`
  - `frontend/src/app/manager/tasks/page.tsx`
  - `frontend/src/app/assistant_manager/tasks/page.tsx`
  - `frontend/src/app/employee/tasks/page.tsx`
- Added the `<option value="yearly">Year(s)</option>` select option so users can properly trigger the newly restored yearly backend logic.

## 5. Test Results
Wrote isolated unit tests verifying:
- Daily recurrence interval advancement.
- Weekly recurrence jumping to specific configured weekdays.
- Monthly 31st edge case (Jan 31 -> Feb 29 -> Mar 31).
- Yearly leap-year edge case (Feb 29 2024 -> Feb 28 2025).
All mathematical computations now pass smoothly without calendar drift.

## 6. Remaining Risks & Future Recommendations
- **Concurrency**: If the backend is horizontally scaled, `run_periodic_tasks()` will run on multiple pods, potentially causing race conditions. Recommendation: Use a distributed lock (e.g., Redis `SETNX`) or a dedicated worker queue like Celery.
- **Transactions**: MongoDB `update` operations inside `spawn_tasks_from_rule` are currently done sequentially. Recommendation: Implement Beanie / Motor transactions to atomically insert tasks and update the rule `next_run` flag.
