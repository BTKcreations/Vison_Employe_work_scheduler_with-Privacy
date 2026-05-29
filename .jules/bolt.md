## 2024-05-18 - Optimized DB-level count vs Memory footprint
**Learning:** Pulling full MongoDB documents into Python memory just to compute unique counts using `to_list()` and sets is a major performance bottleneck for frequently accessed endpoints, specifically in Beanie ODM.
**Action:** Always prefer Database-level distinct/aggregate operations (like `{"$group": {"_id": "$user_id"}}` then `{"$count": "present_count"}`) when fetching unique values or aggregated counts rather than processing them in Python memory.
