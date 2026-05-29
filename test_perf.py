import asyncio
import time
from unittest.mock import AsyncMock, patch

async def mock_benchmark():
    class MockCategory:
        def __init__(self, _id, name):
            self.id = _id
            self.name = name

        @classmethod
        async def get(cls, _id):
            await asyncio.sleep(0.002) # Mock database latency
            return cls(_id, f"Cat {_id}")

    class MockCategoryQuery:
        def __init__(self, ids):
            self.ids = ids

        async def to_list(self):
            await asyncio.sleep(0.005) # Mock db latency for a single batch query
            return [MockCategory(_id, f"Cat {_id}") for _id in self.ids]

    class MockCategoryFind:
        @classmethod
        def find(cls, query):
            ids = query["_id"]["$in"]
            return MockCategoryQuery(ids)

    # test payload
    category_ids = list(range(50))

    # Original logic
    start = time.perf_counter()
    cat_names = []
    for cid in category_ids:
        cat = await MockCategory.get(cid)
        if cat:
            cat_names.append(cat.name)
    end = time.perf_counter()
    original_time = end - start

    # Optimized logic
    start = time.perf_counter()
    cat_names_opt = []
    if category_ids:
        categories = await MockCategoryFind.find({"_id": {"$in": category_ids}}).to_list()
        cat_map = {c.id: c.name for c in categories}
        cat_names_opt = [cat_map[cid] for cid in category_ids if cid in cat_map]
    end = time.perf_counter()
    opt_time = end - start

    print(f"Original time: {original_time:.5f}s")
    print(f"Optimized time: {opt_time:.5f}s")
    print(f"Improvement: {original_time / opt_time:.2f}x")

    assert cat_names == cat_names_opt

asyncio.run(mock_benchmark())
