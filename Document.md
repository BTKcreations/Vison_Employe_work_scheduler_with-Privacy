# Vision SaaS: Employee Productivity & Attendance Tracking System

## Project Overview
**Vision** is a high-performance, SaaS-ready full-stack platform designed for enterprise-grade productivity management and attendance tracking. It features a streamlined task-oriented workflow, automated geolocation-based attendance, and a multi-tier management hierarchy (5-Tier RBAC) to support complex organizational structures.

## Core Capabilities

### 🛡️ 5-Tier SaaS RBAC
The platform supports a robust role-based access control system to enable strict data isolation and management hierarchy:
*   **Super Admin**: Global platform oversight and multi-tenant management.
*   **Admin**: Company-level administration, employee onboarding, and organizational settings.
*   **Manager**: Team oversight, attendance auditing, and work assignment.
*   **Assistant Manager**: Operational support and real-time task monitoring.
*   **Employee**: Core portal for work execution and automated attendance tracking.

### 📍 Advanced Attendance Tracking
*   **Automatic Geolocation Capture**: Capture live GPS coordinates (Lat/Long) automatically during login/logout for compliance and auditability.
*   **Dynamic Work Calendars**: Configure company-specific workdays (e.g., Mon-Fri, Mon-Sat) and shift timings.
*   **Real-time Status**: Management can see who is currently active and their last known location.

### 👑 Professional Task Management (Work-Centric)
The system has been optimized for a **Work-Description-First** workflow, removing redundant titles and focusing on actionable work items.

#### Task Management Columns:
*   **S.No**: Sequential tracking of items.
*   **Employee Name**: Who is performing the work.
*   **Company Name**: Client or Internal company association.
*   **Work Description**: Detailed scope of the work item.
*   **Work Priority**: Critical, High, Medium, or Low.
*   **Dead-line**: Precise time-bound target.

### 📊 Advanced Report Generation
Comprehensive reporting tools for data-driven decision making. Reports include:
*   **Time Variance Analysis**: Automatically calculates the difference between Dead-line and Completion Time (Early/Late variance).
*   **Points Ledger**: Tracks reward points earned per task.
*   **Remarks History**: Full audit trail of communication on every work item.
*   **Multi-Format Export**: One-click export to **CSV** and **Excel**.

#### Standard Report Schema:
`S.No | Employee Name | Company Name | Work Description | Work Priority | Dead-line | Completed Time | Time Variance | Status | Remarks | Points | Created Time | Assigned By`

## Technical Architecture

### ⚡ Performance & UX
*   **Zero-Latency Design**: Removed all heavy animations to ensure a "snappy" enterprise experience.
*   **Light-Themed UI**: Professional Slate/Indigo palette optimized for high visibility and professional focus.
*   **Glassmorphism**: Premium aesthetic with semi-transparent layers for a modern SaaS feel.

### 🛠️ Technology Stack
*   **Frontend**: Next.js (TypeScript), Tailwind CSS, Lucide Icons, Recharts.
*   **Backend**: FastAPI (Python), MongoDB (Beanie ODM).
*   **Security**: JWT-based Authentication with strict Company-level data isolation.

## Project Status
The platform is **Production-Ready**. It supports a full SaaS lifecycle from employee onboarding and company scheduling to advanced work tracking and performance reporting.
