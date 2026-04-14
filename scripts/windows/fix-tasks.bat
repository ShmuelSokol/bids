@echo off
REM One-shot patcher: re-register each DIBS task with `cmd /c` wrapping
REM around the dispatcher so Task Scheduler invokes it through cmd.exe
REM (which understands setlocal/set/etc). Without this wrap, Task
REM Scheduler may try to execute .bat files directly and they fail
REM before producing any log output.
REM
REM Run as Administrator. Same install location: C:\tmp\dibs-init\dibs

setlocal

set DISPATCHER=C:\tmp\dibs-init\dibs\scripts\windows\run-dibs-task.bat

if not exist "%DISPATCHER%" (
    echo ERROR: %DISPATCHER% not found.
    exit /b 1
)

echo.
echo Patching DIBS task actions to use cmd /c wrapper...
echo.

schtasks /change /tn "DIBS - Abe Bids Sync" ^
    /tr "cmd /c \"\"%DISPATCHER%\" sync-abe-bids-live\"" >nul
echo Patched: DIBS - Abe Bids Sync

schtasks /change /tn "DIBS - LamLinks Sol Import AM" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-solicitations\"" >nul
echo Patched: DIBS - LamLinks Sol Import AM

schtasks /change /tn "DIBS - LamLinks Sol Import PM" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-solicitations\"" >nul
echo Patched: DIBS - LamLinks Sol Import PM

schtasks /change /tn "DIBS - Awards Import" ^
    /tr "cmd /c \"\"%DISPATCHER%\" import-lamlinks-awards\"" >nul
echo Patched: DIBS - Awards Import

schtasks /change /tn "DIBS - Shipping Sync" ^
    /tr "cmd /c \"\"%DISPATCHER%\" sync-shipping\"" >nul
echo Patched: DIBS - Shipping Sync

schtasks /change /tn "DIBS - Daily Briefing" ^
    /tr "cmd /c \"\"%DISPATCHER%\" send-daily-briefing\"" >nul
echo Patched: DIBS - Daily Briefing

echo.
echo Done. Verify with: check-status.bat
echo Then test: schtasks /run /tn "DIBS - LamLinks Sol Import AM"
