## Date
2024-05-27 (Mock)

## Title
Fix Recurrence Month Clamping

## Learning
Using custom math `min(day, last_day_of_month)` for month clamping drifts the underlying recurrence anchor day. Relying on `python-dateutil`'s `relativedelta` elegantly handles short month end clamps without mutating the source `rule_day` parameter. Always utilize robust date libraries when modeling recurrence systems.

## Action
Added `python-dateutil` requirement. Refactored `calculate_next_run` logic. Fixed frontend and backend lack of `Yearly` enums and inputs to align with required feature sets.
