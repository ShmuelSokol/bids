@echo off
REM Dispatcher called by Windows Task Scheduler.
REM Usage: run-dibs-task.bat <script-name-without-extension>
REM Example: run-dibs-task.bat sync-abe-bids-live
REM
REM Changes to the project directory, timestamps a log entry, runs the
REM script, and appends stdout+stderr to a per-script log under C:\tmp\dibs-logs\.

setlocal

set DIBS_DIR=C:\tmp\dibs-init\dibs
set LOG_DIR=C:\tmp\dibs-logs
set SCRIPT=%~1

if "%SCRIPT%"=="" (
    echo Usage: run-dibs-task.bat ^<script-name^>
    exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set LOG_FILE=%LOG_DIR%\%SCRIPT%.log

cd /d "%DIBS_DIR%"
if errorlevel 1 (
    echo [%date% %time%] ERROR: could not cd to %DIBS_DIR% >> "%LOG_FILE%"
    exit /b 2
)

REM Self-heal native deps. Check mssql AND its sub-dependency
REM @tediousjs/connection-string — a partial install where the
REM folder exists but sub-deps are gone is worse than a clean miss
REM because it fails at runtime, not at require time.
REM Also do a quick smoke test: try to require mssql. If it throws,
REM reinstall regardless of what folders exist.
node -e "require('mssql/msnodesqlv8')" >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] mssql broken or missing, reinstalling --no-save... >> "%LOG_FILE%"
    call npm install --no-save mssql msnodesqlv8 >> "%LOG_FILE%" 2>&1
    node -e "require('mssql/msnodesqlv8')" >nul 2>&1
    if errorlevel 1 (
        echo [%date% %time%] CRITICAL: mssql reinstall failed, aborting >> "%LOG_FILE%"
        exit /b 3
    )
    echo [%date% %time%] mssql reinstalled successfully >> "%LOG_FILE%"
)

echo. >> "%LOG_FILE%"
echo === [%date% %time%] Starting %SCRIPT% === >> "%LOG_FILE%"
call npx tsx scripts\%SCRIPT%.ts >> "%LOG_FILE%" 2>&1
set EXIT_CODE=%errorlevel%
echo === [%date% %time%] Finished %SCRIPT% (exit %EXIT_CODE%) === >> "%LOG_FILE%"

exit /b %EXIT_CODE%
