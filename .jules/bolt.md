## 2025-02-23 - Beanie ODM Distinct Query Compatibility
**Learning:** In the current backend Beanie/Motor environment setup, you cannot use `Model.find(query).distinct(field)` because the `FindMany` query object throws an AttributeError (`'FindMany' object has no attribute 'distinct'`).
**Action:** Always use the class-level method `Model.distinct(field, query)` instead of chaining `.distinct()` to `.find()` when performing optimized database-level unique counts to avoid runtime application crashes.
