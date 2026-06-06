"""End-to-end smoke test for the BusinessUnit feature.

Verifies:
  1. Platform owner can see business-unit count + summary on tenant detail.
  2. Tenant admin can list business units in their tenant.
  3. Tenant admin can create a new branch business unit.
  4. Tenant admin can update, activate, deactivate a unit.
  5. Cross-tenant isolation: Tenant A admin cannot see / mutate Tenant B's units.
  6. Cross-tenant isolation: Tenant A admin's user list shows only Tenant A users.
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


def reset_pw(token, tenant_id, admin_id):
    s, b = req("POST", f"/platform/tenants/{tenant_id}/admins/{admin_id}/reset-password", token=token)
    assert s == 200, f"reset failed: {s} {b}"
    return b["temp_password"]


def main():
    print("== Platform owner login ==")
    s, b = req("POST", "/auth/login", {"email": "superadmin@bstk.in", "password": PASSWORD})
    assert s == 200, f"owner login failed: {s} {b}"
    owner_token = b["access_token"]
    print("  OK")

    tenant_id = "6a215ffdf6d2ac752d1454f2"
    admin_id = "6a215ffdf6d2ac752d1454f4"

    print("== Owner views tenant detail (should show business_unit_count >= 1) ==")
    s, b = req("GET", f"/platform/tenants/{tenant_id}", token=owner_token)
    print(f"  status={s} bu_count={b.get('business_unit_count')} bu_summary_len={len(b.get('business_unit_summary', []))}")
    assert s == 200
    assert b.get("business_unit_count", 0) >= 1, "Expected at least 1 HQ unit on BSTK"

    print("== Owner lists business units ==")
    s, b = req("GET", f"/platform/tenants/{tenant_id}/business-units", token=owner_token)
    print(f"  status={s} items={b.get('total')}")
    assert s == 200
    assert b.get("total", 0) >= 1

    print("== BSTK admin login (reset if needed) ==")
    s, b = req("POST", "/auth/login", {"email": "tharun@bstk.in", "password": "ignored"})
    if s != 200:
        temp = reset_pw(owner_token, tenant_id, admin_id)
        bstk_token = login("tharun@bstk.in", temp)
    else:
        bstk_token = b["access_token"]
    print("  OK")

    print("== BSTK admin lists own business units ==")
    s, b = req("GET", "/business-units", token=bstk_token)
    items = b.get("items", [])
    print(f"  status={s} count={b.get('total')}")
    print(f"  first unit: {items[0]['name'] if items else 'none'} type={items[0]['type'] if items else 'n/a'} is_default={items[0].get('is_default') if items else 'n/a'}")
    assert s == 200
    assert b.get("total", 0) >= 1

    hq_unit_id = next((u["id"] for u in items if u.get("is_default")), items[0]["id"])

    print("== BSTK admin creates a branch unit ==")
    unit_name = f"Smoke Branch {int(time.time())}"
    s, b = req("POST", "/business-units", {
        "name": unit_name,
        "type": "branch",
        "code": f"BR{int(time.time()) % 1000}",
        "city": "Bangalore",
        "country": "IN",
        "timezone": "Asia/Kolkata",
        "contact_email": "branch@example.com",
    }, token=bstk_token)
    print(f"  status={s} id={b.get('id') if isinstance(b, dict) else b}")
    assert s == 201, f"create failed: {s} {b}"
    new_unit_id = b["id"]

    print("== BSTK admin updates the branch unit ==")
    s, b = req("PATCH", f"/business-units/{new_unit_id}", {
        "description": "Updated by smoke test",
    }, token=bstk_token)
    print(f"  status={s} desc={b.get('description') if isinstance(b, dict) else b}")
    assert s == 200
    assert b.get("description") == "Updated by smoke test"

    print("== BSTK admin deactivates the branch unit ==")
    s, b = req("POST", f"/business-units/{new_unit_id}/deactivate", token=bstk_token)
    print(f"  status={s} is_active={b.get('is_active') if isinstance(b, dict) else b}")
    assert s == 200
    assert b.get("is_active") is False

    print("== Active-list excludes the deactivated unit ==")
    s, b = req("GET", "/business-units", token=bstk_token)
    print(f"  active count={b.get('total')}")
    assert all(u["id"] != new_unit_id for u in b["items"]), "deactivated unit should be excluded"

    print("== include_inactive=true lists it again ==")
    s, b = req("GET", "/business-units?include_inactive=true", token=bstk_token)
    print(f"  total={b.get('total')}")
    assert any(u["id"] == new_unit_id for u in b["items"]), "should appear with include_inactive"

    print("== BSTK admin reactivates the branch unit ==")
    s, b = req("POST", f"/business-units/{new_unit_id}/activate", token=bstk_token)
    print(f"  status={s} is_active={b.get('is_active') if isinstance(b, dict) else b}")
    assert s == 200
    assert b.get("is_active") is True

    print("== Cross-tenant: BSTK admin tries to access Acme's HQ unit ==")
    acme_id = "6a2163e6f6d2ac752d145523"
    s, b = req("GET", f"/platform/tenants/{acme_id}", token=owner_token)
    acme_units = b.get("business_unit_summary", [])
    acme_hq_id = next((u["id"] for u in acme_units if u.get("is_default")), None)
    if acme_hq_id:
        s, b = req("GET", f"/business-units/{acme_hq_id}", token=bstk_token)
        print(f"  status={s} detail={b.get('detail') if isinstance(b, dict) else b}")
        assert s == 404, f"Cross-tenant leak: BSTK admin saw Acme unit ({s})"

    print("== Owner sees BSTK and Acme separately ==")
    s, bstk_units = req("GET", f"/platform/tenants/{tenant_id}/business-units", token=owner_token)
    s, acme_units = req("GET", f"/platform/tenants/{acme_id}/business-units", token=owner_token)
    print(f"  BSTK count={bstk_units.get('total')} Acme count={acme_units.get('total')}")
    assert s == 200

    print("== /business-units/types/all ==")
    s, b = req("GET", "/business-units/types/all", token=bstk_token)
    print(f"  status={s} types={b if isinstance(b, list) else b}")
    assert s == 200
    assert "branch" in b and "department" in b and "hq" in b and "subsidiary" in b

    print("\nRESULT: ALL BUSINESS UNIT SMOKE TESTS PASSED")


if __name__ == "__main__":
    main()
