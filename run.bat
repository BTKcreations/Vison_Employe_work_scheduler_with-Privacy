@echo off
echo Activating virtual environment and starting backend...
start cmd /k "call venv\Scripts\activate.bat && cd backend && uvicorn app.main:app --reload --port 8000"

echo Starting frontend...
start cmd /k "cd frontend && npm run dev"

echo Both backend and frontend are starting in separate command windows.