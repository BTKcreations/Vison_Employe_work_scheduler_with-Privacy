# Vision SaaS: Employee Productivity & Attendance Tracking System
## Comprehensive Technical & Feature Report

## 1. Executive Summary

Vision SaaS is a highly scalable, full-stack enterprise web application specifically designed to overhaul modern workforce management. By bringing together task assignment, precise location-aware attendance tracking, performance-based reward systems, intelligent payroll modeling, AI insight caching, and direct real-time chat, it drives efficiency across organizations. The platform features strict multi-tier role-based access control (RBAC), multi-tenant SaaS architecture concepts, and real-time operational insights—packaged in a zero-latency, high-performance UI tailored for enterprise usability.

---

## 2. Technical Architecture & Implementation

Vision SaaS employs a robust, decoupled architecture separating the front-end presentation from back-end business logic, ensuring scalability, security, and developer productivity.

### 2.1 Backend: High-Performance Python API
*   **Framework:** FastAPI - chosen for its exceptional speed, asynchronous support, and automatic OpenAPI schema generation.
*   **Database:** MongoDB via **Beanie ODM**. Beanie seamlessly bridges asynchronous database operations with strict Pydantic data validation.
*   **Authentication & Security:** JWT (JSON Web Tokens) provides stateless, secure, token-based authentication. The application enforces data isolation down to the `company_id` level, ensuring multi-tenant data safety.
*   **Background Processing:** Native `asyncio` loops run within FastAPI's lifespan handlers to continuously process recurring tasks (`recurrence_service.process_recurrence`) and execute "auto-checkout" logic for stale attendance sessions.

### 2.2 Frontend: Modern Reactive UI
*   **Framework:** Next.js 16 with React 19 (App Router).
*   **Styling:** Tailwind CSS v4 delivers a utility-first approach.
*   **Data Visualization:** Recharts is integrated to provide complex interactive dashboards, translating metrics into graphical formats.
*   **State Management:** React Context (AuthContext) and Axios interceptors for attaching JWT tokens to API calls.

---

## 3. Dedicated Feature Breakdown

### 3.1 Advanced 5-Tier SaaS RBAC
Hierarchical role-based access control restriction:
1.  **Super Admin:** Global oversight, system-wide settings.
2.  **Admin:** Full access within a specific Company boundary.
3.  **Manager:** Focused on specific teams.
4.  **Assistant Manager:** Operational support.
5.  **Employee:** Baseline user for work execution and tracking.
6.  **HR Roles:** The `UserRole` enum also includes `HR_MANAGER` and `ASSISTANT_HR_MANAGER` for payroll and leave operations.

### 3.2 Smart Geolocation & Attendance
*   **Automated Location Capture:** Captures precise Lat/Long coordinates.
*   **Drift & Distance Analytics:** Uses `Company` model configurations like `office_lat/lng`, `geofence_radius_meters`, and `location_drift_threshold_km`.
*   **Auto-Checkout Protection:** Analyzes sessions via an asynchronous worker. If a session is open 14 hours post-login or past company standard hours (e.g., `work_end_time`), the system auto-closes it and appends `[Auto-closed by system]`.
*   **Regularization:** Employees can request attendance anomaly corrections via the `AttendanceRegularization` model, tracked through PENDING, VERIFIED, and APPROVED/REJECTED states.

### 3.3 Work-Centric Task Engine
*   **Dynamic Prioritization & Deadlines:** Tasks are assigned critical, high, medium, or low priorities alongside precise deadlines.
*   **Time Variance Calculation:** Automatically tracks early/late task completions relative to deadlines.
*   **Recurring Tasks Engine:** Configured via `RecurrenceRule` with daily, weekly, monthly frequencies. It monitors `next_run` to automatically spawn new `Task` clones from a `task_template_id`.
*   **Categorization:** Tasks can have multiple associated categories (`category_ids`).

### 3.4 Gamified Performance & Reward Ledger
*   **Dynamic Configurations:** The `Company` model manages configurable parameters like `task_priority_points`, `delay_penalties`, `early_completion_multiplier`, and `quality_multipliers`.
*   **Incentives:** Predefined `incentive_tiers` and performance scores.
*   **Points Ledger:** Every employee accumulates points automatically computed and credited when task statuses reach `COMPLETED`.

### 3.5 Complete Payroll & Leave Management
*   **Leave Types:** Supported via the `Leave` model (Casual, Sick, Earned, LOP, WFH).
*   **Payroll Generation:** Handled by the `Payroll` model linking `SalaryStructure` components (Basic, HRA, PF, etc.) with dynamic day aggregates (Present, Absent, Leaves). Status flows from DRAFT to PAID.
*   **Company Limits:** Leave thresholds (like `sick_leave_limit`, `casual_leave_limit`) are centrally defined in the company settings.

### 3.6 Communication & Intelligence Modules
*   **Internal Chat System:** Powered by `ChatMessage` models supporting texts, attachments, linked task cards (`task_card_id`), and tip mechanisms (`tip_points`).
*   **AI Insights:** System caches computed intelligence metrics (like `dashboard_summary` or `payroll_anomaly`) in the `CachedAIInsight` collection to offload repetitive generation costs while ensuring managers see rapid analytical feedback.

---

## 4. Application Workflows

### Workflow 1: Employee Onboarding & Setup (Admin)
1.  **Frontend Action:** Admin fills an employee form mapping HR roles, direct reporting managers, and identifying details (`identity_card_url`, etc.).
2.  **API Call:** A `POST /admin/employees` request.
3.  **Backend Logic:** Validates the payload against `CreateEmployeeRequest`, hashes passwords, attaches `company_id`, initializes `reward_points` to 0.0, and saves to MongoDB.

### Workflow 2: Daily Employee Check-In
1.  **Frontend Action:** Employee accesses Dashboard; browser grants location API permissions; user checks in.
2.  **API Call:** `POST /attendance/check-in` sending current coordinates.
3.  **Backend Logic:** Distance/drift is evaluated against `office_lat/lng`. An `Attendance` document creates.
4.  **Failure Net:** The `auto_checkout_stale_sessions` background coroutine checks hourly to force-close any stale `check_out == None` sessions.

### Workflow 3: Task Assignment to Completion
1.  **Assignment:** Manager creates task sending `POST /tasks`.
2.  **Backend Logic:** System resolves `TaskPriority`, stores the `deadline`, initializes `reward_given=False`, and handles recurrence if `is_recurrent` is checked.
3.  **Execution & Completion:** Employee marks `COMPLETED` via `PUT /tasks/{id}`.
4.  **Backend Reward Processing:** System records `completed_at`, computes variances, checks `delay_penalties` vs `early_completion_multiplier`, mutates the user's `reward_points`, and commits the transaction.

### Workflow 4: Monthly Payroll Processing
1.  **Preparation:** HR Manager requests draft via `/payroll`.
2.  **Aggregation:** System calculates `present_days` from `Attendance`, subtracts limits evaluated against `Leave` objects, calculates `bonuses` based on task performance metrics, and calculates `deductions`.
3.  **Execution:** The `Payroll` object moves from `DRAFT` to `APPROVED` and finally `PAID`, making it available for Employee portal viewing.
