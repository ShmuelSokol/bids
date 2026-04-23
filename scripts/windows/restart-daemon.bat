@echo off
REM Kill + restart the DIBS Recurring Daemon so it picks up any new TASKS
REM added to scripts/dibs-recurring-daemon.ts.
REM
REM Just double-click this file (no admin needed if you're the task owner).
REM
REM What it does:
REM   1. /end   — stops the current daemon process
REM   2. /run   — starts it again immediately (doesn't wait for the next schedule)
REM
REM Output tells you both steps worked. Look for "SUCCESS" twice.

setlocal

echo.
echo === Restarting DIBS Recurring Daemon ===
echo.

echo [1/2] Stopping current instance...
schtasks /end /tn "DIBS - Recurring Daemon"
if errorlevel 1 (
    echo   ^(Task wasn't running, continuing...^)
)

echo.
echo [2/2] Starting fresh instance...
schtasks /run /tn "DIBS - Recurring Daemon"
if errorlevel 1 (
    echo.
    echo FAILED to start the task. Check:
    echo   - Task is registered:   schtasks /query /tn "DIBS - Recurring Daemon"
    echo   - Your user is logged in ^(interactive tasks require an active session^)
    exit /b 1
)

echo.
echo Done. Tail C:\tmp\dibs-logs\sync-ll-edi-transmissions.log in ~5 min to confirm first tick.
echo.

pause
