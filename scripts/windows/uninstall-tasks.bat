@echo off
REM Remove all DIBS scheduled tasks. Run from an Administrator cmd.

echo Removing DIBS scheduled tasks...
echo.

for %%T in (
    "DIBS - Abe Bids Sync"
    "DIBS - LamLinks Sol Import AM"
    "DIBS - LamLinks Sol Import PM"
    "DIBS - Awards Import"
    "DIBS - Shipping Sync"
    "DIBS - Daily Briefing"
    "DIBS - Competitor Awards Scrape"
    "DIBS - Competitor Awards Import"
) do (
    schtasks /delete /tn %%T /f
)

REM Legacy names from the old setup-task-scheduler.bat — clean up if present
for %%T in (
    "DIBS - LamLinks Import"
) do (
    schtasks /delete /tn %%T /f 2>nul
)

echo.
echo Done. Verify with: schtasks /query /tn "DIBS*"
