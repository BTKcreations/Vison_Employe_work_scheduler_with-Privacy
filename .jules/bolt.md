# 2024-05-29
## Title: N+1 Queries with Beanie ODM
## Learning: Beanie ODM requires explicit batch queries using the `In` operator to avoid N+1 problems when resolving multiple relationships manually since it doesn't automatically batch sequential `.get()` calls in a loop.
## Action: I've updated the task routing endpoints to perform bulk relationship resolution using `.find(In(Category.id, category_ids)).to_list()` instead of sequential loops.
