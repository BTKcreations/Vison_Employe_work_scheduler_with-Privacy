@echo off
title Vision Employee Work Scheduler - Premium Unified Test Runner
color 0B

echo =======================================================================
echo               VISION WORK SCHEDULER - PREMIUM TEST SUITE               
echo =======================================================================
echo.

echo [STAGE 1/3] Activating Virtual Environment and Checking Dependencies...
if not exist venv goto :no_venv

call venv\Scripts\activate
pip install -r backend\requirements.txt pytest pytest-asyncio httpx >nul 2>&1
echo [STAGE 1/3 COMPLETE] Dependencies verified and virtual environment active.
echo.
goto :stage2

:no_venv
echo [ERROR] Python Virtual Environment (venv) not found. Please create it first.
exit /b 1

:stage2
echo [STAGE 2/3] Executing Backend Integration Tests (Pytest)...
echo -----------------------------------------------------------------------
cd backend
python -m pytest -v tests/
set PYTEST_EXIT=%ERRORLEVEL%
cd ..
echo -----------------------------------------------------------------------
if %PYTEST_EXIT% neq 0 goto :test_failed
echo [STAGE 2/3 COMPLETE] Backend integration tests passed with 100% success.
echo.
goto :stage3

:test_failed
echo [ERROR] Backend integration tests failed! Aborting simulation execution.
exit /b %PYTEST_EXIT%

:stage3
echo [STAGE 3/3] Launching End-to-End Synthetic User Workflow Simulation...
echo -----------------------------------------------------------------------
python scratch\e2e_simulation.py
set SIM_EXIT=%ERRORLEVEL%
echo -----------------------------------------------------------------------
if %SIM_EXIT% neq 0 goto :sim_failed
echo [STAGE 3/3 COMPLETE] End-to-End simulation completed successfully.
echo.
goto :success

:sim_failed
echo [ERROR] End-to-End Workflow Simulation failed!
exit /b %SIM_EXIT%

:success
echo =======================================================================
echo               ALL INTEGRATION TESTS AND SIMULATIONS PASSED             
echo =======================================================================
pause
