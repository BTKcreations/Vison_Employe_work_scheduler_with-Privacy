# Logic Gaps Analysis (Backend + Frontend)

This analysis focuses on production-impact logic flaws, tenant isolation risks, permission inconsistencies, and maintainability gaps.

## Critical Gaps

### 1) Plain-text password storage (`raw_password`) is a severe security risk
- `User` model stores `raw_password` as plain text.
- Password change endpoint writes new plain text password to DB.
- Impact: credential disclosure risk and likely compliance violations.
- Files:
  - `backend/app/models/user.py`
  - `backend/app/routes/auth.py`

### 2) Over-broad task assignment for non-super admins (`for_all`)
- In `create_task`, users with `admin/hr/finance/it/auditor` and `for_all=true` fetch all non-admin users globally.
- This crosses tenant boundaries in multi-tenant mode.
- Expected: limit by company ownership/scope before selecting recipients.
- File:
  - `backend/app/routes/tasks.py`

### 3) Weak settings update contract (`dict` payload)
- `PUT /settings` accepts untyped `dict`, no strong schema validation.
- Invalid shapes/ranges can silently corrupt configuration behavior.
- File:
  - `backend/app/routes/settings.py`

### 4) Hard-coded timezone logic in auto-checkout
- Uses `UTC + 5:30` directly in backend scheduled checkout logic.
- Breaks for US/EU tenants and distributed deployments.
- Expected: per-company timezone configuration and timezone-aware datetime handling.
- File:
  - `backend/app/main.py`

### 5) Sensitive default JWT secret and permissive CORS defaults
- `JWT_SECRET` has insecure default string.
- `CORS_ORIGINS` defaults to `*`.
- Risk: insecure deployment if env not overridden.
- File:
  - `backend/app/config.py`

## High Priority Gaps

### 6) Permission model not consistently enforced at route level
- Many routes still use role checks and hierarchy checks ad hoc rather than atomic permission checks.
- Creates drift between `roles.permissions` data model and actual authorization enforcement.
- Files:
  - `backend/app/auth/dependencies.py`
  - `backend/app/routes/*.py` (notably tasks/employees/settings)

### 7) Settings auto-creation side effects on read
- `GET /settings` creates company-level settings if missing.
- Read operation mutates state, which complicates auditability and caching behavior.
- File:
  - `backend/app/routes/settings.py`

### 8) Inconsistent role source of truth in frontend
- Frontend derives authorization mainly from `user.role`, but backend supports `role_id`, `role_display_name`, and granular permissions.
- Custom role behavior may be hidden or misrepresented in UI capability checks.
- File:
  - `frontend/src/contexts/AuthContext.tsx`

### 9) Axios auth token in localStorage only
- Storing JWT in localStorage increases XSS impact surface.
- Consider secure cookie strategy with short-lived access token + refresh token rotation.
- File:
  - `frontend/src/lib/api.ts`

### 10) Super-admin dashboard metrics are derived from non-dedicated endpoints
- Dashboard calls `/companies/all` and `/admin/employees` then computes stats client-side.
- This is brittle and can become expensive; should be dedicated aggregated backend endpoint.
- File:
  - `frontend/src/app/super_admin/dashboard/page.tsx`

## Medium Priority Gaps

### 11) Role checker mixes enum/object/string comparison patterns
- `arch` may be enum or string, comparisons are repeated and inconsistent across helpers.
- Increases risk of subtle authorization bypass/false denial.
- File:
  - `backend/app/auth/dependencies.py`

### 12) Company scope logic duplicated in many routes
- Same owner/company access logic repeats across routes.
- Centralizing in reusable guard utilities would reduce inconsistency bugs.
- Files:
  - `backend/app/routes/tasks.py`
  - `backend/app/routes/settings.py`
  - `backend/app/routes/companies.py`
  - `backend/app/routes/employees.py`

### 13) Settings model stores numeric maps as string-key dictionaries
- Structures like `delay_reductions` and `incentive_tiers` use string keys for numeric thresholds.
- Makes validation, ordering, and calculations more error-prone.
- File:
  - `backend/app/models/system_settings.py`

### 14) Background worker lifecycle robustness
- Background loop is started in app lifespan and cancelled on shutdown, but no graceful cancellation handling around long-running operations.
- Could cause partial writes during shutdown/restart windows.
- File:
  - `backend/app/main.py`

## Recommended Fix Sequence

1. **Security-first hotfixes**
   - Remove `raw_password` field and stop writing plain text password.
   - Enforce required `JWT_SECRET` from env for non-dev mode.
   - Replace wildcard CORS in production configs.

2. **Tenant-boundary fixes**
   - Patch `tasks.create_task` `for_all` behavior to strictly filter by authorized company IDs.
   - Add regression tests for cross-tenant assignment denial.

3. **Authorization normalization**
   - Introduce uniform permission decorators/checkers and migrate critical routes.
   - Use `permissions[]` as UI source of truth for feature gating.

4. **Config safety improvements**
   - Replace `dict` settings payload with typed schema models + strict validation.
   - Introduce config revisioning + audit logs for all mutation endpoints.

5. **Operational hardening**
   - Add per-company timezone setting and timezone-aware attendance automation.
   - Add dedicated super-admin metrics endpoint with server-side aggregation.

## Minimum Test Coverage to Add Immediately

- Auth/security
  - Password change does not persist plain text values.
  - Startup fails in production if JWT secret is default/weak.

- Tenant isolation
  - Admin `for_all` cannot assign tasks outside owned company scope.
  - Manager/ASM cannot assign to users outside hierarchy and company.

- Settings safety
  - Invalid settings payloads are rejected with schema errors.
  - Settings reads do not create records unless explicitly requested.

- Permissions
  - Endpoints requiring `tasks:assign`, `roles:manage`, etc. enforce permission correctly for custom roles.

---

If you want, next step I can convert this analysis into an executable hardening plan with file-by-file patches (starting with the 3 critical fixes) and include migration notes.
