## 2025-02-28 - N+1 Query Bottleneck in Report Service
**Learning:** Found an N+1 query bottleneck in `backend/app/services/report_service.py` within the `generate_employees_excel` function. It was doing 2 DB queries per employee in a loop to count tasks. This is highly inefficient in MongoDB and Python.
**Action:** Use MongoDB's `aggregate` with `$match` and `$group` to fetch the same data in a single bulk query and create an in-memory lookup table. This reduces network roundtrips from `O(N)` to `O(1)`. Always look for loops containing DB calls.
