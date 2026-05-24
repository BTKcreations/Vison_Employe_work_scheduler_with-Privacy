# Employee Work Scheduler And Performance System

A full-stack employee scheduling, task management, attendance, leave, reporting, and rewards platform with multi-tenant company isolation and role/custom-permission controls.

## Tech Stack

### Backend
- FastAPI
- Beanie ODM with MongoDB
- Pydantic v2 settings and schemas
- JWT authentication
- Pandas and OpenPyXL for exports

### Frontend
- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- Axios
- Recharts
- Lucide React

## Current Features

- JWT login and current-user profile APIs
- Multi-role access: super admin, admin, manager, assistant manager, employee, contractor, HR, finance, IT, auditor, and support archetypes
- Custom company roles with inherited and denied permissions
- Company and employee management with supervisor hierarchy
- Task creation, assignment, recurrence, status updates, comments, categories, and reward calculation
- Attendance check-in/check-out with geofence and auto-checkout support
- Leave application, balances, subordinate review, approval, rejection, and cancellation
- Notifications and peer recognition
- Dashboards, leaderboards, payroll summaries, and Excel/CSV reports
- Global search across employees, companies, and tasks with tenant and hierarchy filtering

## Project Structure

```text
backend/
  app/
    auth/          JWT, password hashing, auth dependencies
    database/      MongoDB and Beanie initialization
    models/        Beanie document models
    routes/        FastAPI route modules
    schemas/       Pydantic request/response models
    services/      Business logic and authorization helpers
    main.py        FastAPI application entrypoint
  tests/           Backend integration and regression tests

frontend/
  src/
    app/           Next.js route groups for role portals
    components/    Shared UI components
    contexts/      Auth context and permission helpers
    lib/           Axios API client and utilities
    types/         Shared TypeScript interfaces
```

## Environment Variables

Backend settings are read from `backend/.env` or the process environment.

```env
APP_ENV=development
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=employee_task_reward
JWT_SECRET=change-this-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
CORS_ORIGINS=*
```

For production, set `APP_ENV=production`. Production startup rejects the default/weak `JWT_SECRET` and wildcard `CORS_ORIGINS`.

Frontend API configuration:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If `NEXT_PUBLIC_API_URL` is not set, the frontend uses the current browser host on port `8000`.

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8000
```

MongoDB must be running and reachable at `MONGODB_URL`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Testing

Backend tests require MongoDB on `localhost:27017` unless `MONGODB_URL` is overridden.

```bash
cd backend
python -m pytest
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

## Important Security Notes

- Keep `JWT_SECRET` private and strong in production.
- Use explicit production CORS origins.
- The frontend currently stores the access token in `localStorage`; a secure cookie plus refresh-token flow would reduce XSS blast radius.
- Authorization should continue to use the shared backend helpers in `app/services/authorization_service.py` to avoid tenant-scope drift.
