# Customization & Superadmin Manageability Roadmap

## Current State Snapshot

The codebase already has strong building blocks for multi-tenant customization:

- Tenant-aware company model and subscription controls (`subscription_max_employees`, `subscription_max_roles`, `subscription_geofencing`).
- Company-level settings with global fallback in `SystemSettings`.
- Custom role templates with archetypes + per-company custom permissions.
- Distinct route areas for `super_admin`, `admin`, `manager`, and `employee` frontend experiences.

## Gaps to Reach “Fully Customizable for Admins”

1. **Settings schema is unversioned and weakly validated in updates** (`dict` payload in `PUT /settings`).
2. **Customization options are scattered** (company settings, roles, categories, holidays, rules) without a single “policy plane.”
3. **No reusable presets/profiles** (admins cannot clone a baseline config for a new company).
4. **Limited governance tooling for superadmin** (insufficient centralized audit/change review of admin actions).
5. **No feature-flag matrix per plan/company/role** (hard to safely expose advanced capabilities).
6. **Insufficient lifecycle controls** (draft/publish, rollback, staged rollout of configuration changes).

## Target Architecture (Recommended)

### 1) Introduce a Tenant Policy Engine (Config as Data)
Create a new `tenant_policies` collection with typed sections:

- `attendance_policy`
- `task_scoring_policy`
- `leave_policy`
- `workflow_policy`
- `notification_policy`
- `ui_policy`
- `integration_policy`

Each section should include:
- `schema_version`
- `effective_from`
- `status` (`draft`, `published`, `archived`)
- `updated_by`
- `change_reason`

**Why:** This centralizes all admin customization into one domain object while keeping modular policy sections.

### 2) Enforce Typed Update Contracts
Replace free-form update payloads with strict Pydantic schemas:

- `SystemSettingsUpdateRequest`
- `AttendancePolicyUpdateRequest`
- `TaskScorePolicyUpdateRequest`

Add validators for threshold ranges, monotonic incentive tiers, and non-negative multipliers.

**Why:** Prevents invalid runtime configs and reduces support burden.

### 3) Add Policy Versioning + Rollback
On each publish:

- Store immutable snapshot (`policy_revision` document).
- Record diff from previous published version.
- Allow one-click rollback to previous revision.

**Why:** Admins can safely experiment; superadmin gets operational resilience.

### 4) Add Presets / Templates
Support:

- Global superadmin templates (e.g., Retail, BPO, Manufacturing).
- Company admin “save as preset.”
- Clone preset during company onboarding.

**Why:** Drastically reduces setup time and standardizes best practices.

### 5) Build a Feature Flag Matrix
Add `feature_flags` at three scopes:

- Global default (superadmin)
- Company override
- Role override

Example flags:
- `advanced_reports`
- `geo_fence_strict_mode`
- `performance_incentive_v2`
- `api_tokens`

**Why:** Enables phased rollout and plan-based capability control.

### 6) Superadmin Control Tower
Create a consolidated superadmin console for:

- Company health KPIs
- Policy drift detection (company vs global baseline)
- Failed integrations / jobs
- Security events (login anomalies, permission changes)
- Cross-tenant activity logs with filters

**Why:** Makes the application owner’s day-to-day oversight efficient.

### 7) Comprehensive Audit Trail
Add append-only `audit_events` for:

- Role/permission updates
- Settings updates
- Company plan changes
- User activation/deactivation

Store: actor, tenant, entity, action, old value hash, new value hash, IP/device metadata.

**Why:** Critical for accountability, compliance, and incident response.

### 8) Delegated Administration Model
Add scoped admin capabilities:

- `admin_billing`
- `admin_people`
- `admin_policy`
- `admin_reports`

Use permission bundles rather than one broad admin profile.

**Why:** Reduces blast radius and supports larger organizations.

### 9) Automation for Superadmin Operations
Implement workflows:

- Auto-provision company from template
- Plan enforcement jobs (disable over-limit actions with grace period)
- Monthly policy compliance report
- Inactive admin detection + alerts

**Why:** Removes manual supervision burden from the owner.

### 10) UX Upgrades for Customization
For admin-facing settings UI:

- Guided wizard with sensible defaults
- Inline validation + simulation preview
- “What changed?” before publish
- Environment-like modes: `draft` vs `live`

**Why:** Reduces misconfiguration and improves confidence.

## Concrete Implementation Plan (Phased)

### Phase 1 (2–3 weeks): Stabilize Current Settings
- Add typed update schemas for `/settings`.
- Add strict validation and response normalization.
- Add audit logging for all settings/roles/company updates.
- Add policy revision history for existing settings object.

### Phase 2 (3–4 weeks): Unified Policy Domain
- Introduce `tenant_policies` model and routes.
- Migrate existing settings to policy sections.
- Build draft/publish/rollback API flow.
- Add superadmin template CRUD.

### Phase 3 (3–4 weeks): Superadmin Control Tower
- Build cross-tenant dashboard APIs.
- Add drift detection and health scoring.
- Add alert center (threshold-based).

### Phase 4 (2–3 weeks): Delegation + Flags
- Add scoped admin bundles.
- Introduce feature-flag inheritance and overrides.
- Add UI screens for role-based feature toggles.

## Suggested Data Models (High-Level)

- `tenant_policies`
  - `company_id`
  - `revision`
  - `status`
  - `sections` (typed embedded docs)
  - `published_at`, `published_by`

- `policy_templates`
  - `name`, `industry`, `version`
  - `sections`
  - `is_global_default`

- `feature_flags`
  - `scope_type` (`global`, `company`, `role`)
  - `scope_id`
  - `flags` map

- `audit_events`
  - `tenant_id`, `actor_id`, `entity_type`, `entity_id`, `action`
  - `before`, `after`, `timestamp`, `metadata`

## Priority Recommendations (If You Want Fast Impact)

Top 5 immediate wins:

1. Typed settings API contracts + validation.
2. Audit trail for all admin/superadmin actions.
3. Draft/publish + rollback for settings changes.
4. Superadmin template cloning for company onboarding.
5. Cross-tenant dashboard for plan usage and policy drift.

These five improvements will make the platform significantly more customizable for admins and substantially easier to operate for the superadmin/application owner.
