# Procmon: Capture a Bid Post for SFTP Reverse-Engineering

We've fully reverse-engineered the **invoice** WAWF transmission (ck5_tab.dbf
inside .laz, SFTP to /incoming/). **Bids** use a similar mechanism but
different inner format. To finish bid automation we need ONE procmon
capture during Abe's bid Post.

## Procedure (~5 min)

### Setup on COOKIE (Abe's workstation)

1. Open Procmon as administrator (already installed from invoice capture)
2. `Ctrl+L` to open Filter dialog
3. **Reset** filters, then add TWO Include rules:
   - `Process Name` is `lamlinkspro.exe` Include
   - `Operation` is `Process Create` Include
4. Confirm 4 capture types are ON: Reg / File / Network / Process (toolbar)
5. `Ctrl+X` to clear buffer

### Capture

6. Have Abe **click Post** on a bid envelope in LL — pick one with at least
   1-2 quoted lines that's ready to send. ONE click. Wait for terminal flash.
7. Wait 10 seconds for any followup activity
8. `Ctrl+E` to stop capture

### Save + Extract

9. `File` → `Save…` → "All events in filter" → CSV → save as
   `bid-post.csv` to Desktop

10. From any PowerShell:

```
$o = "$env:TEMP\bid-post-relevant.txt"; Import-Csv 'C:\Users\ajoseph\Downloads\ProcessMonitor\bid-post.csv' | Where-Object { $_.Operation -match '(Process Create|TCP|UDP|WriteFile|CreateFile|SetRenameInformationFile)' -and ($_.Path -match '(\.laz|\.txt|\.dbf|\.fpt|\\temp\\|\\\\|api\.|\.com|curl|powershell|cmd|winscp)' -or $_.Detail -match '(http|https|ftp|api|--data|curl|\.laz|\.txt|\.dbf|winscp)') } | Select-Object 'Time of Day', Operation, Path, Result, Detail | Format-Table -AutoSize -Wrap | Out-File $o -Width 400; notepad $o
```

11. Also grab the WinSCP script + log files referenced in the trace:

```
# Find newest A*.txt in temp (WinSCP script with creds + filename)
$scripts = Get-ChildItem 'C:\LamlinkP\LLPclint\data\temp\' -Filter 'A*.txt' | Sort-Object LastWriteTime -Descending | Select-Object -First 4
$scripts | ForEach-Object { Get-Content $_.FullName | Set-Content "C:\Users\Public\bidpost-$($_.Name)" }; Get-ChildItem 'C:\Users\Public\bidpost-*.txt' | Format-Table FullName, Length
```

12. Also copy any new `.laz` or `.txt` outputs that appeared during the click:

```
Get-ChildItem 'C:\LamlinkP\LLPclint\data\temp\' | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-3) } | Sort-Object LastWriteTime -Descending | Select-Object FullName, LastWriteTime, Length
# For each output file, base64-encode it for paste-back to GLOVE:
foreach ($f in (Get-ChildItem 'C:\LamlinkP\LLPclint\data\temp\' | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-3) -and ($_.Extension -eq '.laz' -or $_.Extension -eq '.txt' -or $_.Extension -eq '.dbf') })) {
  Copy-Item $f.FullName "C:\Users\Public\bidpost-$($f.Name)"
}
Get-ChildItem 'C:\Users\Public\bidpost-*'
```

### What we need back

Paste these into the next session:
1. Output of step 10 (relevant procmon rows — esp. **Process Create** rows with full curl/winscp command lines)
2. Output of step 11 (WinSCP script files showing `put <local>` and host)
3. Either the binary files themselves (base64-encoded) OR the file listing from step 12

## What we'll do with it

Once we have the trace + sample files:
1. Identify file extension (`.laz` zipped or raw `.txt`)
2. Identify inner table(s) (k33_tab.dbf? k34_tab.dbf? combined?)
3. Build `buildBidDbf()` in `src/lib/ll-bid-laz.ts` (mirror of ll-ck5-dbf.ts)
4. Wire `transmitBidEnvelope()` into `processBidQueue()` after the SQL piggyback
5. Test with a canary bid (similar safety pattern to invoice canary)

Estimate: ~2 hours of focused work once we have the trace.
