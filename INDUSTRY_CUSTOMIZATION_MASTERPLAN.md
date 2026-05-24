# Industry Customization Master Plan

## 1) What Is Already Implemented (Current Foundation)

Based on current backend/frontend modules, your app already includes strong base capabilities:

### Core Modules Already Present
- Authentication and JWT session flows.
- Multi-role access model (Super Admin, Admin, Manager, Assistant Manager, Employee + additional archetypes).
- Company/Tenant management.
- Employee lifecycle and hierarchy management.
- Task management (including recurring tasks and categories).
- Attendance tracking and controls.
- Leave management.
- Holiday management.
- Role management with custom roles and permissions.
- Dashboard and reporting endpoints.
- Notifications and global search.
- Peer recognition/collaboration.

This is a very solid foundation for a highly customizable multi-tenant product.

---

## 2) Your Goal (Reframed as Product Architecture)

You asked for:
- **Admins should create any role**.
- **Each role can be under another role** (role hierarchy graph).
- **Frontend views/features must be customizable by role**.
- **Template roles should be editable** and usable as quick starters.
- The system should be **deeply customizable for every industry**.
- UX should feel **easy for non-technical users**.

To achieve this at scale, implement **4 layers of customization**:

1. **Identity & Role Layer** (who the user is)
2. **Policy Layer** (what rules run)
3. **Feature/UI Layer** (what the user sees)
4. **Workflow Layer** (how work moves)

---

## 3) Critical Logic/Architecture Gaps To Close Next

1. Role model currently supports custom roles and permissions, but not a robust **role inheritance tree/graph** with conflict resolution.
2. UI access is still mostly mapped to broad role labels in several pages; should pivot to **permission + feature flag + view policy** composition.
3. Feature set is good but industry adaptability requires **pluggable policy packs** (attendance, leave, scoring, payroll-style adapters, compliance packs).
4. Admin usability needs a **guided builder UX** instead of raw forms.

---

## 4) Target Data Model for “Any Industry” Customization

## A) Role Graph (Parent/Child + Inheritance)

Create/extend entities:
- `company_roles`
  - `id`, `company_id`
  - `display_name`
  - `base_archetype` (optional starter)
  - `parent_role_ids[]`  ← supports “this role is under this role”
  - `permissions[]`
  - `denied_permissions[]` (for explicit deny)
  - `ui_profile_id`
  - `is_template`, `is_custom`, `is_active`

Rules:
- DAG only (no cyclic parent links).
- Effective permissions = union(parents + self) − explicit denies.
- Company-level templates clone from global templates.

## B) View/UI Profiles (Role-based UI composition)

Create `ui_profiles`:
- `name`, `company_id`
- `navigation` (menu items, labels, order)
- `widgets` (dashboard cards/charts)
- `page_visibility` map
- `field_visibility` map
- `actions` map (create/edit/delete/approve/export)
- `theme` (colors, density, language pack, date format)

Attach `ui_profile_id` to role.

## C) Feature Flags With Inheritance

Create `feature_flags` with precedence:
1. Global default
2. Company override
3. Role override
4. User override (optional)

This allows controlled rollout of advanced features.

## D) Policy Packs (Industry Logic)

Create `policy_packs` and `tenant_policy_bindings`:
- Retail Pack, Manufacturing Pack, Healthcare Pack, BPO Pack, Logistics Pack, etc.
- Sections:
  - attendance policy
  - leave policy
  - task scoring/incentive policy
  - compliance policy
  - escalation policy

Each policy section must be versioned and publishable.

---

## 5) Admin Experience: Make It Easy (No-Code Style)

### Role Builder Wizard
Step-based:
1. Choose template (or blank role)
2. Set parent role(s)
3. Select capabilities (permission bundles)
4. Pick UI profile
5. Preview “What this role can do”
6. Publish

### UI Builder for Admins
- Drag-and-drop navigation/menu visibility.
- Toggle modules per role.
- Dashboard widget selection.
- “Login as preview role” sandbox.

### Policy Studio
- Human-readable sliders/tables for attendance, leave, and scoring.
- Simulation panel (“If employee is 2 days late, points become X”).
- Draft/publish/rollback.

---

## 6) Feature Expansion Roadmap (To Become Fully Adaptable)

Add optional modules that can be enabled via feature flags per industry:

### Workforce & HR
- Shift planning and rota optimization.
- Overtime rule engines.
- Skill matrix + certification expiry tracking.
- Probation/performance review cycles.

### Operations
- Project/milestone planning.
- SLA & ticket queue support.
- Asset/equipment assignment tracking.
- Geo-fence advanced modes (multi-site).

### Compliance & Governance
- Audit center (every policy/role change traceable).
- Approval workflows with multi-step sign-off.
- Policy attestation (users acknowledge updates).
- Data retention/legal hold controls.

### Finance/Rewards
- Incentive plan designer.
- Attendance/payroll export adapters.
- Budget guardrails for rewards and overtime.

### Engagement
- Goal/OKR tracking.
- Pulse surveys and sentiment snapshots.
- Gamification packs (badges, streaks, seasonal campaigns).

---

## 7) Backend Implementation Blueprint (Practical)

## Phase 1 (Immediate)
- Add role parent relationship (`parent_role_ids[]`) + cycle checks.
- Add effective permission resolver service.
- Replace hard role checks across routes with permission checks.
- Introduce `ui_profiles` CRUD APIs.

## Phase 2
- Add feature-flag inheritance engine.
- Add role-to-ui-profile binding and frontend dynamic menu rendering.
- Add draft/publish/rollback for role and policy changes.

## Phase 3
- Add policy packs and template marketplace (global + company).
- Add industry onboarding wizard (choose pack → configure basics → publish).

## Phase 4
- Add deep analytics: policy drift, permission anomalies, usage heatmap.
- Add automation engine (“if attendance below threshold, notify manager + create task”).

---

## 8) Frontend Customization Blueprint

Move from hardcoded role pages to policy-driven rendering:

- Keep route groups (admin/manager/employee) for ergonomics.
- Introduce runtime checks based on:
  - `permissions[]`
  - `feature_flags`
  - `ui_profile.page_visibility`
- Render navigation from API-provided profile config.
- Add “Manage Experience” section under Admin Settings:
  - Roles
  - UI Profiles
  - Feature Toggles
  - Workflow Rules
  - Templates

---

## 9) What This Delivers for You

With this model:
- Any admin can create highly specific roles.
- Role hierarchy can mirror real org structures.
- Every role can get a tailored UI/feature experience.
- Templates make setup fast but still editable.
- Superadmin keeps control via versioning, audit trails, and global governance.
- Product becomes truly horizontal and industry-adaptable.

---

## 10) Recommended First 6 Deliverables (Start Here)

1. Role inheritance graph (`parent_role_ids`) + effective-permission resolver.
2. UI profile model + dynamic side navigation renderer.
3. Feature-flag inheritance (global → company → role).
4. Policy draft/publish/rollback for settings.
5. Admin wizard: create role from template with preview.
6. Superadmin oversight page: policy drift + permission anomaly checks.

These six items will create the strongest jump toward “very very customizable” while still staying user-friendly.
