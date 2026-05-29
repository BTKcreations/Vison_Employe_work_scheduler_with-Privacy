## 2024-06-25 - [Beanie DB Aggregation Optimization]
**Learning:** In the Beanie ODM structure used here, fetching full documents into memory with `.to_list()` and doing calculations in Python memory (like `len(set(...))`) is a massive anti-pattern that can crash the app with large collections.
**Action:** Always prefer MongoDB's aggregation pipeline (`$match`, `$group`, `$count`) computed natively at the database level over Python-side processing for analytics endpoints (e.g., dashboard stats).
