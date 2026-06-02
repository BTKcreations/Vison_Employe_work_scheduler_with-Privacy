# Vision SaaS: Application Capabilities & Technical Documentation

Vision is a high-performance, enterprise-grade Employee Task & Reward Management System designed to optimize workforce productivity through gamification, AI-driven insights, and automated administrative workflows.

## 1. 🛡️ 6-Tier Role-Based Access Control (RBAC)
The system features a rigid hierarchical structure ensuring data isolation and specialized permissions:

1.  **Admin (Super Admin)**: Global oversight, full access to all companies, employees, and system-wide configurations.
2.  **HR Manager**: Oversees recruitment, leave policies, payroll drafting, and organizational rules.
3.  **Assistant HR Manager**: Operational HR support, managing employee files and leave approvals under an HR Manager.
4.  **Manager**: Team lead responsible for work allocation, task approvals, and performance auditing.
5.  **Assistant Manager**: Directly monitors employee workflows, provides real-time task support, and manages reportees.
6.  **Employee**: The core user tier focused on task execution, attendance tracking, and earning reward points.

## 2. 👑 Professional Task Management & Gamification
The "Work-First" workflow is designed to maximize output and quality.
*   **Dynamic Priority System**: Tasks are categorized as Critical, High, Medium, Regular, or Low.
*   **Reward Points Algorithm**:
    *   **Base Points**: Earn points automatically upon task completion based on priority.
    *   **Early Bonus**: Multiplier (e.g., 1.1x) for completing tasks well before the deadline.
    *   **Delay Penalties**: Points are dynamically reduced based on the degree of lateness (e.g., 75% for 1 day, 50% for 2 days).
    *   **Quality Multipliers**: Managers can adjust points post-completion for "Exemplary" work or "Rework" requirements.
*   **Recurrence Engine**: Automated daily, weekly, or monthly task generation for routine operations.

## 3. 📍 Geofence-Enabled Smart Attendance
Automated attendance tracking with high-integrity validation:
*   **GPS Verification**: Capture precise Latitude/Longitude during check-in/out.
*   **Geofence Policy**:
    *   **Strict**: Rejects check-ins outside the permitted radius of the office.
    *   **Flexible**: Allows check-ins but flags "Outside Geofence" anomalies for audit.
*   **Location Drift Detection**: Flags sessions where check-in and check-out locations differ significantly.
*   **Auto-Checkout**: Background service closes stale sessions past working hours.
*   **Minimum Session Duration**: Enforces a required duration before allowing a check-out.

## 4. 🧠 AI Workforce Intelligence
Built-in AI engine (OpenAI compatible) providing deep operational insights:
*   **Executive Dashboard Summary**: Role-specific natural language summaries of team/personal status.
*   **Task Intelligence**: Predicts task completion risks and flags overloaded assignees.
*   **Performance Analytics**: Detects burnout risks, productivity trends, and work consistency.
*   **Payroll Anomaly Scanner**: Flags overtime spikes, variance outliers, and suspicious deductions.
*   **AI Copilot Assistant**: In-app chat widget for querying operational data using natural language.

## 5. 💰 Automated Payroll & Salary Engine
Streamlined financial processing linked directly to productivity data:
*   **Salary Structures**: Configurable components including Basic, HRA, Special Allowances, PF, ESI, and Taxes.
*   **Dynamic Drafting**: Automatically pulls data from Attendance (Present/LOP days), Leaves, and Task Reward Points.
*   **Lifecycle Management**: Workflow from Automated Draft -> Review -> Locked -> Paid.
*   **Incentives & Penalties**: Integrated handling of early bonuses, late penalties, and performance-based incentives.

## 6. 📅 Leave & Regularization
*   **Leave Management**: Multi-category PTO tracking (Casual, Sick, Earned) with balance enforcement.
*   **Attendance Regularization**: Request-based correction of missed punches or system errors with proof/remarks.
*   **Multi-Level Approvals**: Streamlined verification by Managers and HR.

## 7. 📊 Reporting & Collaboration
*   **Rich Analytics**: Interactive charts (Recharts) for task status, priority distribution, and productivity.
*   **Leaderboards**: Real-time ranking of top employees based on reward points.
*   **Multi-Format Export**: Export detailed logs to CSV, Excel, or print-ready HTML/PDF-styled reports.
*   **Contextual Chat**: Task-linked group discussions with file-sharing support.

## 🚀 Technical Stack
*   **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
*   **Backend**: FastAPI (Python 3.12), Beanie ODM (Async MongoDB).
*   **Database**: MongoDB.
*   **Security**: JWT (JSON Web Tokens) with Bcrypt hashing and strict hierarchical data scoping.
