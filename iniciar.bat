@echo off
cd /d "%~dp0"

echo Iniciando backend...
start "Backend FastAPI" cmd /k "cd backend && venv\Scripts\uvicorn app.main:app --reload --port 8000"

echo Iniciando frontend...
start "Frontend React" cmd /k "cd frontend && npm run dev"

pause