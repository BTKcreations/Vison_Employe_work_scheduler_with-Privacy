# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Employee Task & Reward Management System - a full-stack web application for managing employee tasks, attendance tracking, rewards, and productivity analytics.

- **Backend**: FastAPI (Python) with MongoDB via Motor + Beanie ODM
- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS 4
- **Database**: MongoDB (connection configured in `backend/.env`)

## Commands

### Backend (FastAPI)

```bash
# Start development server
cd backend
uvicorn app.main:app --reload --port 8000

# Run seed data (creates initial admin user)
cd backend
python seed.py
```

**Default admin credentials**: `admin@admin.com` / `admin123`

### Frontend (Next.js)

```bash
cd frontend
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Architecture

### Backend Structure (`backend/app/`)

- **Routes** (`routes/`): API endpoints - auth, employees, tasks, attendance, dashboard, reports, companies, holidays, search
- **Models** (`models/`): MongoDB documents - User, Task, RecurringTask, Attendance, Company, Holiday, ActivityLog
- **Services** (`services/`): Business logic - task_service, recurrence_service, dashboard_service, user_service, report_service
- **Schemas** (`schemas/`): Pydantic models for request/response validation
- **Auth** (`auth/`): JWT authentication and password hashing

**Key features**:
- Recurring task engine runs as background task (checks every hour)
- JWT-based authentication with role-based access control
- Reward points system for task completion

### Frontend Structure (`frontend/src/`)

- **Pages** (`app/`): Next.js App Router pages
  - `/login` - Authentication
  - `/admin/*` - Admin dashboard, tasks, employees, companies, attendance, reports, settings
  - `/employee/*` - Employee dashboard, tasks, attendance, reports
- **Components**: DashboardCharts, StatusChart, GlobalSearch, AttendanceToggle, UserLink
- **Contexts**: AuthContext for authentication state management
- **Types** (`types/index.ts`): TypeScript interfaces for User, Task, Attendance, Company, etc.
- **Lib** (`lib/api.ts`): Axios instance with JWT interceptor

**Role hierarchy**: `super_admin` > `admin` > `manager` > `assistant_manager` > `employee`

### Environment Variables

Create `backend/.env` from `backend/.env.example`:
- `MONGODB_URL` - MongoDB connection string
- `SECRET_KEY` - JWT signing key
- `CORS_ORIGINS` - Allowed frontend origins