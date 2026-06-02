## 2025-05-24 - Beanie Query Serialization in Aggregations
**Learning:** Python comparison expressions (e.g., `Model.field >= value`) in Beanie return internal `Comparison` objects. These are not directly serializable for MongoDB's native driver (Motor/PyMongo) when nested in dictionaries, which often happens in `aggregate` or `distinct` calls. This leads to runtime `bson.errors.InvalidDocument` or `TypeError`.
**Action:** Always use Beanie operators from `beanie.operators` (e.g., `GTE`, `NE`, `In`) when building manual query dictionaries for `aggregate` or `distinct`. These operators return plain dictionaries that are safe for the driver.

## 2026-06-01 - In-memory RBAC Filtering Anti-pattern
**Learning:** Several core visibility functions (like `get_visible_employee_ids`) were fetching the entire User collection into memory and filtering in Python. This causes severe performance degradation as the user base grows.
**Action:** Replace in-memory filtering with database-level operations. Use `Model.distinct("_id", query)` to efficiently retrieve just the necessary IDs for visibility sets.
