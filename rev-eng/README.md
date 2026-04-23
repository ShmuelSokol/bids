# LamLinks reverse engineering

Working directory for reverse-engineering the LamLinks (LL) platform — a Visual FoxPro 9 desktop app distributed as compiled binaries. The owner is deceased; the son is running the vendor now. We reverse-engineered LL so DIBS can integrate with it cleanly, avoiding weeks of back-and-forth with a vendor that can no longer answer many of our questions.

**Findings live in** `docs/lamlinks-reverse-engineering.md`. Start there.

## What's in `strings/`

Raw string-extraction output from the three LL binaries. Gitignored because `llprun-strings.txt` is ~32 MB. Regenerate any time with Sysinternals `strings64.exe`:

```powershell
# From a machine with access to the LL binaries:
strings64.exe -accepteula -n 6 llprun.exe       > llprun-strings.txt
strings64.exe -accepteula -n 6 lamlinkspro.exe  > lamlinkspro-strings.txt
strings64.exe -accepteula -n 6 llxputil.exe     > llxputil-strings.txt
```

Binary locations (network shared folder):
- `G:\PROGRAMS\LAMLINKS\CONTROL\Lamlinkp\LLPservr\code\llprun.exe` — the server/backend runtime (40.7 MB)
- `C:\LamlinkP\lamlinkspro.exe` — the desktop client (126 KB — just a launcher)
- `G:\PROGRAMS\LAMLINKS\CONTROL\Lamlinkp\LLPservr\code\llxputil.exe` — utility helpers (60 KB)

## Why `strings` and not a real decompiler

Attempted ReFox (commercial VFP decompiler). Blocked by SentinelOne at work (flagged as a hack tool) and by consumer antivirus at home. `strings.exe` is Microsoft-signed and not flagged by anything. It doesn't give us the control flow ReFox would, but it gives us:
- Every embedded SQL query and DDL literal
- Every `#DEFINE` constant (including status strings and dispatch function names)
- Every function / procedure boundary
- Every XML element name (via `xml_tag_and_string_to_value('name', ...)` literals)
- Every file path, URL, and error message

That was enough to map LL end-to-end. See the writeup for details.

## Useful grep patterns

```powershell
# State machine values for any status field
Select-String -Path strings\llprun-strings.txt -Pattern "^#DEFINE\s+\w+_stat_\w+"

# RPC function catalog
Select-String -Path strings\llprun-strings.txt -Pattern "^#DEFINE\s+reqfun_kdd_\w+"

# VSE (Client Management) handlers and their process functions
Select-String -Path strings\llprun-strings.txt -Pattern "process_vse_\w+_function|a_name_kea_\w+"

# CREATE TABLE DDL for any k-table
Select-String -Path strings\llprun-strings.txt -Pattern "^CREATE TABLE dbo\.\w+_tab"

# XML element names consumed by a handler
Select-String -Path strings\llprun-strings.txt -Pattern "xml_tag_and_string_to_value\s*\(\s*['\"]"
```
