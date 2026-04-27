# ProcMon capture guide — recovering LL Sally api_key/api_secret

**Goal:** capture the file or registry read that loads `api_key` + `api_secret`
into LL's process memory at startup. The `api_key` (27-char `7Lx`-prefix) and
`api_secret` (14-char mixed) live on disk somewhere on a working LL workstation
— Process Monitor (ProcMon, free Sysinternals tool) records every file/registry
operation a process makes, so we can find which file LL reads them from.

**Time required:** 10–15 minutes.
**Need:** admin access to a workstation with LL installed (Abe's COOKIE box, or
any other LL-active workstation). If you don't have admin on that box, RDP in
as a user that does.

We already confirmed the values are NOT in the SQL DB (`kah_tab`,
`credential_control_*`, etc. all probed empty for `api_key`). They must be
read from a config file or registry key at LL launch.

---

## Step 1 — Get ProcMon

Download from Microsoft Sysinternals (no install needed; runs from extracted ZIP):

<https://learn.microsoft.com/en-us/sysinternals/downloads/procmon>

Direct ZIP: <https://download.sysinternals.com/files/ProcessMonitor.zip>

Extract to a folder you can find easily. We'll use `Procmon64.exe` (the 64-bit
version is fine for any Win 7+).

---

## Step 2 — Set up the filter (BEFORE launching LL)

1. Run `Procmon64.exe` as Administrator (right-click → Run as administrator).
   On first launch you'll get the Sysinternals license dialog — accept.

2. ProcMon starts capturing immediately. Press **Ctrl + E** to *pause* the capture
   while we set the filter. (The big magnifying-glass icon in the toolbar — when
   it has an X over it, capture is paused.)

3. Press **Ctrl + L** to open the Filter dialog. Add these rules:

   | Column | Relation | Value | Action |
   |--------|----------|-------|--------|
   | Process Name | is | `llprun.exe` | Include |
   | Process Name | is | `llpclint.exe` | Include |
   | Operation | is | `Process Start` | Include |
   | Path | contains | `LamlinkP` | Include |
   | Path | contains | `Lamlink` | Include |
   | Path | ends with | `.ini` | Include |
   | Path | ends with | `.cfg` | Include |
   | Path | ends with | `.dat` | Include |
   | Path | ends with | `.key` | Include |

   Click **Add** after each row, then **OK**.

4. Press **Ctrl + X** to *clear* the existing capture buffer (it'll have other
   junk in it from before the filter).

---

## Step 3 — Capture LL startup

1. Make sure LL is **closed** (kill `llprun.exe` / `llpclint.exe` in Task
   Manager if needed).

2. Press **Ctrl + E** in ProcMon to *resume* capture. (Magnifying glass icon
   should now look "live", no X.)

3. Launch LL normally (Start Menu shortcut, or `C:\LamlinkP\LLPclint\llpclint.exe`).

4. Wait until LL is fully loaded (login screen + main menu visible).

5. Back in ProcMon, press **Ctrl + E** to *pause* capture. You should now have
   a few hundred to a few thousand events.

---

## Step 4 — Find the api_key

The `api_key` always starts with `7Lx` for LamLinks Clients. Search the captured
events for that string:

1. Press **Ctrl + F** (Find).
2. Type `7Lx` — leave "Match Whole Word" unchecked.
3. Click **Find Next**.

ProcMon searches the visible columns. It won't find `7Lx` in the path/operation
columns themselves — but you'll spot a `ReadFile` operation on a config-ish
file. Click on that event row, then press **Ctrl + Q** to view the *Properties*
of that event — the **"Detail"** field shows what was read, and the
**"Path"** field shows the source file.

If `Ctrl + F` doesn't directly find `7Lx`, instead:

1. Look at the *Process Start* event for `llprun.exe` (or `llpclint.exe`) — that's
   when LL launches. Note the timestamp.
2. In the next few hundred events, scan for `ReadFile` operations on small
   config files (.ini, .cfg, .dat, .key) inside `C:\LamlinkP\` or
   `C:\Users\<username>\LamlinkP\`.
3. For each suspicious file, **right-click → Jump To** in ProcMon will open
   Explorer at that path. Open the file in Notepad and search for `7Lx`.

The `api_key` will be in plaintext (or trivially encoded). We've seen no
encryption on these creds — same lazy storage as the curl logs.

---

## Step 5 — Capture the api_secret

The `api_secret` (14-char) is loaded **at the same time** as the `api_key`,
typically from the same file. Once you find the api_key, the secret is usually
on a nearby line.

If they're in different files, both files will appear close together in the
ProcMon trace. Look for any `ReadFile` operations within 100ms of the api_key
read.

Known values (from 2026-04-24 curl-log capture):
- `api_key`: `7Lx6La4QIpESAgNhfJmSPhWn0Yk` (27 chars)
- `api_secret`: `6i^,j5F29jQxCF` (14 chars, mixed case + `^` + `,`)

If ProcMon shows the same values, we don't need to do anything — they're
already in `.env` on GLOVE. The capture is then just a verification of the
storage location, useful for future debugging.

If ProcMon shows DIFFERENT values, the creds have rotated since 2026-04-24.
Update `.env`:

```
LL_API_KEY=<new value>
LL_API_SECRET=<new value>
```

---

## Step 6 — Hand off the values

**Treat these like a password.** Don't paste them in group chats.

If running on Abe's box: send them to Shmuel via WhatsApp DM (516-236-7397) or
email. Shmuel updates `.env` on GLOVE + Railway. Never commit.

If you want to clear the ProcMon trace from the box, **File → Save** the
capture to a `.PML` file FIRST (in case we need to re-analyze) then close
ProcMon — it doesn't write capture data to disk unless you save.

---

## What to do if ProcMon shows nothing

Possible reasons:

- **LL pulls the keys from a remote share at startup.** Check the
  `G:\PROGRAMS\LAMLINKS\` paths in the captured events. If the `ReadFile`
  is on a UNC path, the file is on the server. We can read it from GLOVE.

- **LL caches the keys in memory across sessions** (e.g. it asks once at
  install and saves to registry). Re-run with the registry filters from
  Step 2 also active.

- **The keys are encrypted at rest** with DPAPI. ProcMon will still show the
  read; the file will just be unreadable in Notepad. Use
  `Get-ChildItem` + `[System.Security.Cryptography.ProtectedData]::Unprotect`
  in PowerShell to decrypt.

- **The keys are baked into the LL binary at install time** (worst case). The
  ProcMon trace will not show a config-file read for them. Last resort: run
  the LL process under a debugger (WinDbg) and dump strings near the auth
  code path. Significantly more involved — flag for Yosef before going there.

---

## Cleanup

After confirming the values:
- Close ProcMon. If you saved a `.PML`, delete it from `Recycle Bin` too.
- Delete any text files where you wrote down the values.
- Verify Abe's LL still launches normally (we didn't change anything).

---

## Why this is the only path left

The 2026-04-27 XE trace conclusively showed the api_key/api_secret are NOT in
LL's SQL database (we probed `kah_tab`, `credential_control_1_view`, all
`*api*` / `*cred*` / `*key*` named tables and views — empty for ERG). They
must come from a filesystem read at LL startup.

ProcMon is the only no-code way to identify the exact file. Once we know
where the keys live, future rotations + onboarding new workstations get
trivial.

If we instead want to skip this and stay on SQL writeback (no Sally REST
yet), that's also fine — DIBS works today via SQL writeback + Abe's manual
Post click. The api_key only unlocks zero-click bid + invoice transmission.
