"""End-to-end smoke test for header-based BusinessUnit scoping (v2).

Verifies the stricter follow-up where each tenant admin view is aggregated
by default but can be narrowed to a single business unit via the
`X-Active-Business-Unit-Id` request header. The frontend axios interceptor
sets this header from localStorage `active_business_unit_id`.

Tests:
  1. Owner login + tenant detail with business-unit summary.
  2. Tenant admin lists BUs; picks a branch unit created in v1 test.
  3. Without header: admin sees employees from every unit (aggregated).
  4. With header=<branch id>: admin sees only employees pinned to that branch.
  5. With header=<hq id>: admin sees only HQ-pinned employees.
  6. With header=<another tenant's unit id>: 400 (cross-tenant guard).
  7. With header=garbage: 400 (malformed).
  8. With header="all": behaves like no header.
  9. Categories list is BU-scoped the same way.
 10. Tasks list is BU-scoped the same way.
 11. /ai/dashboard-summary responds 200 with each header value.
"""
import json
import time
import urllib.request
import urllib.error

API = "http://127.0.0.1:8000"
PASSWORD = "Tharunkumar123@#!"
TENANT_BSTK = "6a215ffdf6d2ac752d1454f2"
ADMIN_BSTK = "6a215ffdf6d2ac752d1454f4"
TENANT_ACME = "6a2163e6f6d2ac752d145523"


def req(method, path, body=None, token=None, extra_headers=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def login(email, pwd):
    s, b = req("POST", "/auth/login", {"email": email, "password": pwd})
    assert s == 200, f"login {email} failed: {s} {b}"
    return b["access_token"]


def reset_pw(token, tenant_id, admin_id):
    s, b = req("POST", f"/platform/tenants/{tenant_id}/admins/{admin_id}/reset-password", token=token)
    assert s == 200, f"reset failed: {s} {b}"
    return b["temp_password"]


def list_units(token):
    s, b = req("GET", "/business-units?include_inactive=true", token=token)
    assert s == 200, f"list units failed: {s} {b}"
    return b.get("items", [])


def main():
    print("== Owner login ==")
    s, b = req("POST", "/auth/login", {"email": "superadmin@bstk.in", "password": PASSWORD})
    assert s == 200, f"owner login failed: {s} {b}"
    owner_token = b["access_token"]
    print("  OK")

    print("== BSTK admin login ==")
    s, _ = req("POST", "/auth/login", {"email": "tharun@bstk.in", "password": "ignored"})
    if s != 200:
        temp = reset_pw(owner_token, TENANT_BSTK, ADMIN_BSTK)
        bstk_token = login("tharun@bstk.in", temp)
    else:
        bstk_token = login("tharun@bstk.in", "ignored")
    print("  OK")

    units = list_units(bstk_token)
    print(f"  BSTK units: {[u['name'] + ' (' + u['type'] + ')' for u in units]}")
    hq = next((u for u in units if u.get("is_default")), units[0] if units else None)
    assert hq, "expected at least 1 HQ unit"
    branch = next((u for u in units if u.get("type") == "branch"), None)
    if not branch:
        print("  No branch unit yet, creating one for the test ...")
        branch_name = f"Header Branch {int(time.time())}"
        s, b = req("POST", "/business-units", {
            "name": branch_name, "type": "branch",
            "code": f"HB{int(time.time()) % 1000}",
            "city": "Pune", "country": "IN",
        }, token=bstk_token)
        assert s == 201, f"branch create failed: {s} {b}"
        branch = next(u for u in list_units(bstk_token) if u["id"] == b["id"])
    hq_id = hq["id"]
    branch_id = branch["id"]
    print(f"  HQ id = {hq_id}  Branch id = {branch_id}")

    print("\n== Employees: aggregated (no header) ==")
    s, b = req("GET", "/admin/employees", token=bstk_token)
    assert s == 200, f"employees aggregated failed: {s} {b}"
    agg_emps = b if isinstance(b, list) else b.get("items", [])
    print(f"  status={s} count={len(agg_emps)}")
    assert len(agg_emps) >= 1, "should see at least the admin"

    print("\n== Employees: scoped to HQ (header) ==")
    s, b = req("GET", "/admin/employees", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": hq_id})
    assert s == 200, f"hq employees failed: {s} {b}"
    hq_emps = b if isinstance(b, list) else b.get("items", [])
    print(f"  status={s} count={len(hq_emps)}")
    hq_bu_ids = {e.get("business_unit_id") for e in hq_emps}
    print(f"  bu_ids seen: {hq_bu_ids}")
    for emp in hq_emps:
        assert emp.get("business_unit_id") in (hq_id, None), \
            f"employee {emp['name']} has bu_id={emp.get('business_unit_id')} not in HQ"

    print("\n== Employees: scoped to branch (header) ==")
    s, b = req("GET", "/admin/employees", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": branch_id})
    assert s == 200, f"branch employees failed: {s} {b}"
    branch_emps = b if isinstance(b, list) else b.get("items", [])
    print(f"  status={s} count={len(branch_emps)}")
    for emp in branch_emps:
        assert emp.get("business_unit_id") == branch_id, \
            f"employee {emp['name']} has bu_id={emp.get('business_unit_id')} not in branch"
    print(f"  confirmed: every employee pinned to branch_id={branch_id}")

    print("\n== Categories: aggregated (no header) ==")
    s, b = req("GET", "/categories", token=bstk_token)
    assert s == 200, f"categories aggregated failed: {s} {b}"
    agg_cats = b if isinstance(b, list) else b.get("items", [])
    print(f"  status={s} count={len(agg_cats)}")

    print("\n== Categories: scoped to HQ ==")
    s, b = req("GET", "/categories", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": hq_id})
    assert s == 200, f"hq cats failed: {s} {b}"
    hq_cats = b if isinstance(b, list) else b.get("items", [])
    for cat in hq_cats:
        assert cat.get("business_unit_id") in (hq_id, None)

    print("\n== Categories: scoped to branch ==")
    s, b = req("GET", "/categories", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": branch_id})
    assert s == 200, f"branch cats failed: {s} {b}"
    branch_cats = b if isinstance(b, list) else b.get("items", [])
    for cat in branch_cats:
        assert cat.get("business_unit_id") == branch_id, \
            f"category {cat['name']} has bu_id={cat.get('business_unit_id')}"
    print(f"  confirmed: every category in branch_id={branch_id}")

    print("\n== Tasks: aggregated (no header) ==")
    s, b = req("GET", "/tasks", token=bstk_token)
    assert s == 200, f"tasks aggregated failed: {s} {b}"
    agg_tasks = b if isinstance(b, list) else b.get("items", [])
    print(f"  status={s} count={len(agg_tasks)}")

    print("\n== Tasks: scoped to HQ ==")
    s, b = req("GET", "/tasks", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": hq_id})
    assert s == 200, f"hq tasks failed: {s} {b}"
    hq_tasks = b if isinstance(b, list) else b.get("items", [])
    for t in hq_tasks:
        bu = t.get("business_unit_id")
        assert bu in (hq_id, None), f"task {t.get('id')} has bu_id={bu}"

    print("\n== Tasks: scoped to branch ==")
    s, b = req("GET", "/tasks", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": branch_id})
    assert s == 200, f"branch tasks failed: {s} {b}"
    branch_tasks = b if isinstance(b, list) else b.get("items", [])
    for t in branch_tasks:
        bu = t.get("business_unit_id")
        assert bu == branch_id, f"task {t.get('id')} has bu_id={bu}"
    print(f"  confirmed: every task in branch_id={branch_id}")

    print("\n== Guard: cross-tenant header = 400 ==")
    acme_units_resp = req("GET", f"/platform/tenants/{TENANT_ACME}", token=owner_token)[1]
    acme_unit_id = next((u["id"] for u in acme_units_resp.get("business_unit_summary", [])), None)
    if acme_unit_id:
        s, b = req("GET", "/admin/employees", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": acme_unit_id})
        print(f"  status={s} detail={b.get('detail') if isinstance(b, dict) else b}")
        assert s == 400, f"expected 400 for cross-tenant, got {s}"
    else:
        print("  (skipped: no Acme unit available)")

    print("\n== Guard: malformed header = 400 ==")
    s, b = req("GET", "/admin/employees", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": "not-a-real-id"})
    print(f"  status={s} detail={b.get('detail') if isinstance(b, dict) else b}")
    assert s == 400, f"expected 400 for garbage, got {s}"

    print("\n== Header='all' behaves like no header ==")
    s, b_all = req("GET", "/admin/employees", token=bstk_token, extra_headers={"X-Active-Business-Unit-Id": "all"})
    s, b_agg = req("GET", "/admin/employees", token=bstk_token)
    assert s == 200
    n_all = len(b_all if isinstance(b_all, list) else b_all.get("items", []))
    n_agg = len(b_agg if isinstance(b_agg, list) else b_agg.get("items", []))
    print(f"  aggregated={n_agg}  with 'all'={n_all}")
    assert n_all == n_agg

    print("\n== AI dashboard summary scoped ==")
    for label, hdr in [("aggregated", None), ("HQ", hq_id), ("branch", branch_id)]:
        extra = {"X-Active-Business-Unit-Id": hdr} if hdr else None
        s, b = req("GET", "/ai/dashboard-summary", token=bstk_token, extra_headers=extra)
        print(f"  {label}: status={s} summary_len={len(b.get('ai_summary','')) if isinstance(b, dict) else 0}")
        assert s == 200, f"ai dashboard {label} failed: {s} {b}"

    print("\nRESULT: HEADER-BASED BUSINESS UNIT SCOPING OK")


if __name__ == "__main__":
    main()
