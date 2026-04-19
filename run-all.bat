@echo off
REM Start Backend (Flask)
start cmd /k "python server.py"

REM Start Frontend (Vite)
start cmd /k "cd frontend && npm run dev"

echo.
echo ✓ Backend started on http://localhost:5000
echo ✓ Frontend starting on http://localhost:5173
echo.
pause
