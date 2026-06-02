## 2024-05-30 - Beanie ODM distinct optimization
**Learning:** `to_list()` followed by python `set` comprehension is a performance bottleneck in this codebase's architecture for fetching distinct user IDs, increasing memory and taking around ~0.60s per 10k records, whereas `distinct()` takes ~0.09s.
**Action:** When computing unique counts, always use database-level operations (`Model.distinct("field", query)`) instead of fetching full documents into Python memory.
