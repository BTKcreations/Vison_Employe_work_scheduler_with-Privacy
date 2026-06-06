"""End-to-end tenant isolation smoke test.

Creates Tenant B via the platform owner API, signs in as that admin,
adds a task and a category, then signs in as Tenant A (BSTK) admin
and verifies they cannot see Tenant B's data.
"""
import json
import time
import urllib.request
import urllib.error
import random
import string

API = "http://127.0.0.1:8000"
PASSWORD = "Tharunkumar123@#!"


def req(method, path, body=None, token=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
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


def onboard_tenant(owner_token, name, slug, admin_email, plan_code="starter"):
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    body = {
        "tenant_name": f"{name} {suffix}",
        "name": f"{name} {suffix}",
        "slug": f"{slug}-{suffix}",
        "domain": f"{slug}-{suffix}.test",
        "industry": "Testing",
        "company_size": "1-10",
        "country": "IN",
        "timezone": "Asia/Kolkata",
        "currency": "INR",
        "primary_contact_name": "Admin",
        "primary_contact_email": admin_email,
        "admin_name": "Admin",
        "admin_email": admin_email,
        "admin_password": "TempPass1!",
        "plan_code": plan_code,
    }
    s, b = req("POST", "/platform/tenants", body, token=owner_token)
    assert s in (200, 201), f"onboard failed: {s} {b}"
    return b


def main():
    print("== Platform owner login ==")
    s, b = req("POST", "/auth/login", {"email": "superadmin@bstk.in", "password": PASSWORD})
    assert s == 200, f"owner login failed: {s} {b}"
    owner_token = b["access_token"]
    print("  OK")

    print("== Create Tenant B ==")
    admin_b_email = f"adminb_{int(time.time())}@test.com"
    b_resp = onboard_tenant(owner_token, "IsoTest", "isotest", admin_b_email)
    tenant_b_id = b_resp.get("tenant", {}).get("id") or b_resp.get("id")
    temp_pw_b = b_resp.get("admin_user", {}).get("temp_password") or b_resp.get("temp_password") or "TempPass1!"
    print(f"  Tenant B id={tenant_b_id}")

    print("== Tenant B admin login ==")
    s, b = req("POST", "/auth/login", {"email": admin_b_email, "password": temp_pw_b})
    if s != 200:
        # maybe tenant admin has must_change_password; try with the literal pw
        print(f"  login body: {b}")
    token_b = b["access_token"]
    print("  OK")

    print("== Tenant B: create a unique category ==")
    cat_name = f"IsoCat_{int(time.time())}"
    s, b = req("POST", "/categories", {"name": cat_name, "color": "#abcdef"}, token=token_b)
    print(f"  status={s} body={b}")
    assert s in (200, 201), f"category create failed"

    print("== Tenant B: create a unique task ==")
    s, b = req("GET", "/employees", token=token_b)
    emps = b if isinstance(b, list) else b.get("items", [])
    target_id = emps[0]["id"] if emps else None
    body_t = {
        "work_description": f"ISOTEST-SECRET-{int(time.time())}",
        "priority": "regular",
        "deadline": "2099-12-31T23:59:59Z",
    }
    if target_id:
        body_t["assigned_to"] = target_id
    s, b = req("POST", "/tasks", body_t, token=token_b)
    print(f"  task create: status={s}")
    if s not in (200, 201):
        print(f"  body: {b}")
    task_id_b = (b.get("id") if isinstance(b, dict) else None)

    print("== Tenant A (BSTK) admin login ==")
    s, b = req("POST", "/auth/login", {"email": "tharun@bstk.in", "password": "K4ZQDBUxW3TY"})
    if s != 200:
        # try reset
        s2, b2 = req("POST", f"/platform/tenants/6a215ffdf6d2ac752d1454f2/admins/6a215ffdf6d2ac752d1454f4/reset-password", token=owner_token)
        print(f"  reset body: {b2}")
        if "temp_password" in b2:
            token_a = login("tharun@bstk.in", b2["temp_password"])
        else:
            raise SystemExit("can't log in tenant A")
    else:
        token_a = b["access_token"]
    print("  OK")

    print("== Verify isolation ==")
    s, b = req("GET", "/categories", token=token_a)
    a_cats = b if isinstance(b, list) else b.get("items", [])
    a_cat_names = [c.get("name") for c in a_cats]
    leak_cat = cat_name in a_cat_names
    print(f"  /categories: Tenant A sees {len(a_cats)} cats; leak={leak_cat}")

    s, b = req("GET", "/tasks", token=token_a)
    a_tasks = b if isinstance(b, list) else b.get("items", [])
    a_task_descs = [t.get("work_description") for t in a_tasks]
    leak_task = any("ISOTEST-SECRET" in str(d) for d in a_task_descs)
    print(f"  /tasks: Tenant A sees {len(a_tasks)} tasks; leak={leak_task}")

    s, b = req("GET", "/employees", token=token_a)
    a_emps = b if isinstance(b, list) else b.get("items", [])
    a_emp_emails = [e.get("email") for e in a_emps]
    leak_emp = admin_b_email in a_emp_emails
    print(f"  /employees: Tenant A sees {len(a_emps)} emps; leak_email={leak_emp}")

    # Verify Tenant A cannot fetch Tenant B's task directly
    if task_id_b:
        s, b = req("GET", f"/tasks/{task_id_b}", token=token_a)
        print(f"  /tasks/{{B's id}}: Tenant A status={s} body_keys={list(b.keys()) if isinstance(b, dict) else 'n/a'}")

    print("== Verify Tenant B can see own data ==")
    s, b = req("GET", "/categories", token=token_b)
    b_cats = b if isinstance(b, list) else b.get("items", [])
    print(f"  /categories: Tenant B sees {len(b_cats)} cats (incl. {cat_name}? {cat_name in [c.get('name') for c in b_cats]})")

    s, b = req("GET", "/tasks", token=token_b)
    b_tasks = b if isinstance(b, list) else b.get("items", [])
    print(f"  /tasks: Tenant B sees {len(b_tasks)} tasks (incl. ISOTEST-SECRET? {any('ISOTEST-SECRET' in str(t.get('work_description')) for t in b_tasks)})")

    print("== Done ==")
    if leak_cat or leak_task or leak_emp:
        print("RESULT: LEAK DETECTED")
    else:
        print("RESULT: isolation OK")


if __name__ == "__main__":
    main()
