Date: May 29
Title: Task Update Category Fetch N+1 Query Fixed
Learning: Replacing multiple sequential database calls (`await Category.get(cid)`) with a single batch fetch using MongoDB's `$in` operator (`Category.find({"_id": {"$in": cids}}).to_list()`) provides massive performance improvements by reducing I/O network latency.
Action: Implemented a batched lookup using `Category.find` in `backend/app/routes/tasks.py`. Preserved data consistency by mapping categories by ID and resolving them against the existing list to maintain ordering and correctly handle missing records.
