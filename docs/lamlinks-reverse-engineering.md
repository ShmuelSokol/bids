# LamLinks reverse-engineering — findings 2026-04-23

## Why this doc exists

DIBS is the intelligence layer on top of LamLinks (LL). LL is delivered only as compiled binaries, and its owner recently died; the son now runs the vendor and we can't rely on detailed technical answers from them. We reverse-engineered the platform so DIBS can integrate with it cleanly — especially for the invoice + shipment workflows that are eating Abe's day — without waiting on vendor support that may never come.

Everything in this doc is derived from string-extraction of the LL binaries themselves. See `rev-eng/README.md` for how to regenerate the raw data. Line-number citations point into `rev-eng/strings/llprun-strings.txt` unless noted otherwise.

## TL;DR

LL is a Visual FoxPro 9 desktop app. `lamlinkspro.exe` on the client is a 126 KB launcher; the real binary is `llprun.exe` (40.7 MB) on a network share. **All of LL's business logic lives inside that binary as compiled VFP code. There are zero stored procedures, triggers, functions, or CLR assemblies on the SQL Server — `llk_db1` is pure storage.** When the vendor says "everything runs from SQL including stored procedures," he means FoxPro `PROCEDURE` blocks compiled into the EXE, not T-SQL procs.

LL has **three integration paths**, not one:

1. **HTTP REST API at `api.lamlinks.com/api/llsm/create`** (HTTP Digest auth, single dispatch table supporting ~40 functions including `put_client_quote` and `get_awards_by_contract_url`). This is the real external integration surface — the "Sally" API, operational since 2017. Credentials are stored in `kah_tab` per LL user; if ERG has them already, we can skip 90% of the work.
2. **Local job queue `j87_tab`** — processed by either `llprun.exe` (VFP legacy) or a separate **C# Lamlinks Service Manager** (LLSM) service. Same function catalog as the REST API.
3. **Local RPC table `kdd_tab` → `Client Management`** — dispatches to ~10 VSE-named read APIs for incremental sync (per-customer, originally built for client 31902). Inferior surface.

Most of the "bugs" we've been fighting — the `Update conflict in cursor '_9999XXX'` error chief among them — are inherent to VFP-over-ODBC optimistic-concurrency cursors. They can't be fixed server-side. Moving to the REST API path eliminates the cursor entirely.

## Physical layout

**Client workstations** (e.g. Abe's `COOKIE`):
- `C:\LamlinkP\lamlinkspro.exe` — the VFP 9 desktop UI, compiled binary
- `C:\LamlinkP\FOXUSER.DBF` + `FOXUSER.FPT` — local VFP user prefs cache
- `C:\LamlinkP\LLPro.ini` — client config (DB server, user name, server folder path)
- `C:\LamlinkP\llpclint\` — client support files

**Server box** `NYEVRVTC001` (old Windows Server):
- Hosts the Windows service `LamLinksService` (stopped by default) which runs `LamlinksPro.bat` via `srvstart.exe`
- Accesses the shared server folder via G: mapped drive
- This is where the realtime bot *probably* runs, though unconfirmed — `scripts/who-talks-to-llk.ts` showed spid 53 from `NYEVRVTC001` as a persistent 12-hour connection to llk_db1

**Network shared server folder** `G:\PROGRAMS\LAMLINKS\CONTROL\Lamlinkp\LLPservr\`:
- `code\llprun.exe` — VFP 9 backend runtime (40.7 MB, no source available)
- `code\cfoldersinterface.exe` — DoD cFolders EDI submission
- `code\winscp.exe` — SFTP for DLA drop points
- `code\curl.exe` / `getwpage.exe` — HTTP(S)
- `code\senditquiet.exe` — email (for ack notifications)
- `code\pdftotext.exe` (3 versions) — PDF parsing for solicitation text
- `data\sys_file\llk_db1.sql` — one-time DB install script (CREATE TABLE / VIEW)
- No `.prg` source files. No `.ini` in this folder (the server reuses the client `LLPro.ini`).

**Database** `llk_db1` on `NYEVRVSQL001`:
- 217 user tables, 261 views, 268 FK constraints
- **0 stored procedures, 0 triggers, 0 user functions, 0 CLR assemblies**
- Pure storage. Confirmed three different ways:
  1. `sys.objects` without `is_ms_shipped=0` filter — to catch the ms_shipped=1 hiding trick
  2. `sys.assemblies` across every database — no CLR anywhere
  3. `sys.servers` — no linked servers pointing elsewhere

**ERG's internal mirror** `SZY_WinSol` on the same SQL Server — 92 tables + 21 ERG-authored procs refreshed by the SQL Agent job `run Automatic_Import_SZY_WinSol_Table_Groups` every 90 min. Not part of LL; it's ERG's reporting replica.

## The "stored procedures" mystery, fully solved

LL's vendor told Yosef: *"everything runs from SQL including stored procedures."* Taken literally, this is wrong — we confirmed there are zero T-SQL procs anywhere. Decoded, what he meant:

1. FoxPro uses the term "stored procedure" loosely for its own `PROCEDURE` blocks, which run in the client and issue SQL to the server.
2. LL has an RPC table — `kdd_tab` — where a caller inserts a row specifying a function name, and a desktop daemon polls, executes the VFP function, and writes the result back. This "looks like" calling a stored procedure from the caller's perspective, but the procedure is compiled VFP inside `llprun.exe`.
3. `kea_tab`, added 2020-10-13, is a companion table holding per-handler configuration (incremental sync cursors, etc.).

Accepting (2) as the mental model explains everything we were confused about.

## The `kdd_tab` RPC bus

Discovered via grep of llprun.exe strings. The table's own CREATE TABLE comment (line 2604–2655 and mirrored at 737970+) documents the design intent:

> "Enables WebApps to request LamlinksPro functions. The WebApp and desktop sessions are on the same PC. Also enables a realtime desktop Bot to service requests from any source connected to the same llk_db1 database. The WebApp initiates the request via a title change to the Browser object that includes 'check_kdd='. This enables LamlinksPro to respond to App requests without polling/query or using a Timer."

Read that twice. The key phrase for DIBS is *"any source connected to the same llk_db1 database"* — meaning an external integrator (us) can insert a row into kdd_tab and have the desktop realtime bot process it, as long as a bot is running somewhere on the LAN.

### Schema (verbatim DDL, llprun.exe lines 2639–2663)

```sql
CREATE TABLE dbo.kdd_tab (
  idnkdd_kdd int IDENTITY,
  addtme_kdd datetime NOT NULL,      -- row insertion time
  reqtme_kdd datetime NOT NULL,      -- request time (set by caller)
  reqkey_kdd char(64) NOT NULL,      -- unique request key (UNIQUE constraint)
  toutby_kdd datetime NOT NULL,      -- timeout deadline
  req_by_kdd char(32) NOT NULL,      -- requester login
  reqsys_kdd varchar(32) NOT NULL,   -- target system (e.g. 'LamlinksPro Realtime Bot')
  reqfun_kdd char(32) NOT NULL,      -- function name to invoke
  reqsta_kdd char(32) NOT NULL,      -- request status ('requested' when new)
  reqxml_kdd text NOT NULL,          -- XML request payload
  rsptme_kdd datetime NOT NULL,      -- response time (initially = reqtme_kdd)
  rsp_by_kdd char(32) NOT NULL,      -- responder
  rspcod_kdd int NOT NULL,           -- response code (0 = success, 1 = failure)
  rspmsg_kdd varchar(160) NOT NULL,  -- short response message
  rspxml_kdd varchar(7000) NOT NULL, -- XML response — HARD CAP 7000 chars
  reqj05_kdd int,                    -- caller of API function (added via ALTER)
  CONSTRAINT idnkdd_kdd PRIMARY KEY CLUSTERED (idnkdd_kdd),
  CONSTRAINT reqkey_kdd UNIQUE (reqkey_kdd)
)
CREATE INDEX stssta_kdd ON dbo.kdd_tab(reqsys_kdd, reqsta_kdd)  -- bot poll index
CREATE INDEX reqsta_kdd ON dbo.kdd_tab(reqsta_kdd)
CREATE INDEX addtme_kdd ON dbo.kdd_tab(addtme_kdd)
```

`rspxml_kdd varchar(7000)` is a surprising hard cap — one row cannot return more than 7000 characters of XML. Handlers that could produce larger responses must paginate (and they do — see `response_count_limit` in handler code).

### The dispatch chain

From llprun.exe strings around lines 170328–170335 and 765948+:

```
llxp_realtime_bot_function('realtime_bot_exec')         -- the bot's main loop
  → allocate_kdd_row(reqsys)                            -- atomically claim a pending row
  → kdd_row_to_response(form, kdd_view)                 -- parse reqxml_kdd and route
      CASE reqfun = reqfun_kdd_client_management:
        kea_function('kdd_request', kdd_view, @rspcod, @rspmsg, @rspxml)
      CASE reqfun = reqfun_kdd_vrfq_7av65_to_pdf:
        (vRFQ PDF generator — probably prints a virtual RFQ to PDF)
```

Response write-back pattern: the bot updates the same row with `rsptme_kdd`, `rspcod_kdd`, `rspmsg_kdd`, `rspxml_kdd`, and flips `reqsta_kdd` to done. Caller polls on `reqkey_kdd` (UNIQUE) for completion.

Initial request status: `reqsta_kdd_requested = 'requested'`. Response codes: 0 = success, 1 = failure.

### The two top-level reqfun values

Only two `#DEFINE reqfun_kdd_*` exist in the binary:

```
reqfun_kdd_vrfq_7av65_to_pdf  = "vrfq_7av65_to_pdf"       -- PDF generation
reqfun_kdd_client_management  = "Client Management"        -- the whole VSE/RFQ surface
```

So `Client Management` is effectively the entire external API surface.

## The `Client Management` (VSE/RFQ) handler catalog

`kea_function('kdd_request', ...)` dispatches on an inner `a_name_kea` value extracted from the request XML. Every handler has a matching `process_vse_*_function` or `process_vse_rfq_*_function` (the actual VFP function that does the work) plus a pair of helper functions named `mgtxml_to_<entity>_view` (parse input context) and `x##_row_to_<entity>_xml` (serialize response rows).

| `a_name_kea` literal | Backing VFP function | Purpose (verified / inferred from code) |
|---|---|---|
| `VSE Solicitation` | `process_vse_solicitation_function` | Solicitation CRUD — header + lines together |
| `VSE Solicitation Basic Info` | `process_vse_solicitation_basic_info_function` | Header-level sync |
| `VSE Solicitation Line Item` | `process_vse_solicitation_line_item_function` | Incremental line pull (input: `prior_idnk11`, pulls lines > that id) |
| `VSE Solicitation Status` | `process_vse_solicitation_status_changes_function` | Award/status changes pull since `datetime_of_last_change` |
| `VSE Solicitation FAR Clauses` | `process_vse_solicitation_far_clauses_function` | Clause text |
| `VSE Solicitation Owner Change` | `process_vse_soliciation_owner_change_function` *(sic — typo in source)* | Reassign solicitation to new owner |
| `VSE Customer Info` | — | Customer record sync |
| `VSE Customer_Quote` | — | Customer quote CRUD |
| `RFQ Line Item` | `process_vse_rfq_line_item_function` | RFQ line sync |
| `RFQ Quote Line Item` | `process_vse_rfq_quote_function` | RFQ quote lines — closest analog to our k34 writes |

**Important caveat on READ vs WRITE.** The bodies we've decoded (Status Changes, Line Item) show an incremental-pull pattern: caller sends a "since" cursor in the input XML, handler queries a view, bounds by the cursor, serializes results to XML using `xml_tag_and_value_to_string`, updates the stored cursor in `kea_tab.mgtxml_kea`, returns. That's a **read API shape**, not a write. We haven't yet decoded a handler body that writes to a base table via this path.

There is a separate function `vse_solxml_to_db_update` (llprun line 451526) whose name implies VSE-XML → DB writes. Whether that's reachable through kdd_tab with a different `reqfun_kdd` value, or is only callable from inside the desktop, is **open**. See "Open questions" below.

## The REST API ("Sally" / LLSM) — the integration surface we should actually use

Discovered *after* the kdd_tab writeup above. Supersedes the Client Management path for anything DIBS wants to do.

### Architecture

LL is not a pure desktop app. It ships with:
- A public HTTP REST API at `api.lamlinks.com` (beta: `apibeta.lamlinks.com` / `www3.lamlinks.com`; test: `alpha.lamlinks.com` on LAMSV7, `beta.lamlinks.com` on LAMDBDEV) — live since 2017-07-07.
- A **C# Lamlinks Service Manager** service (LLSM) — processes DIBBS scraping, PDF extraction, and DIBBS-quote uploads. Separate binary we haven't reverse-engineered; references in llprun.exe strings: "DQUS" (DIBBS Quote Upload Service), "Jason's C#" (`actuse_l72_dibbs_dqus_quote` define).
- A local job queue `j87_tab` — either the VFP runtime (`reqsys_j87='LIS legacy'`) or LLSM (`reqsys_j87='LLSM'`) polls it.

Internally these share one dispatcher — `sally_query_api_function('sally_api2_function')` — so the function catalog is the same whether you go HTTP or DB-queue.

### HTTP request shape

Fully documented in llprun.exe strings (line 568791–569728):

```bash
curl --digest \
     -u "SALLY_LOGIN#API_KEY:API_SECRET" \
     --data "&wait=60&function=put_client_quote&data=<XML_PAYLOAD>" \
     "http://api.lamlinks.com/api/llsm/create"
```

- **HTTP**, not HTTPS. HTTP Digest auth (pre-shared key + challenge/response, OK secure in transit even over HTTP but old-school).
- Username format: `<sally_login>#<api_key>` with literal `#` separator (line 568791: `"#sally_login###api_key#:#api_secret#"` — the `###` is template-delimiter-plus-literal-`#`).
- Body is form-encoded: `wait=<timeout>&function=<name>&data=<URL-encoded XML>`.
- Response is XML parsed via `xml_tag_and_string_to_value('Response', ...)`.

### API key format

27-char strings with a 3-char prefix indicating type (llprun.exe line 180145–180148):

| Prefix | Key type |
|---|---|
| `K9p` | LamLinks Corp (vendor-internal) |
| `t0H` | Theo (vendor-internal) |
| `Tg4` | Temp / bootstrap (for client software retrieving real key) |
| `7Lx` | LamLinks Client (**what ERG's key should start with**) |

The only hard-coded key in llprun.exe is a temp bootstrap: `Tg4w02Gfduk1508aYYLmJFI9Gt7` (27 chars, starts with `Tg4`). Real client keys are stored per-user in the database.

### Function catalog (REST / j87 / LIS)

`sally_api_interface` callable names (line 727815+):

- `put_client_quote` — **write a quote** (our main target for the write path)
- `get_tdp_meta_data` — technical data package metadata
- `get_awards_by_contract_url` — lookup awards by a contract URL
- `sol_no_to_tdps` — solicitation → TDP records
- `sol_no_to_quote_info` — solicitation → quote info
- `e_code_to_entity_info` — entity lookup by e_code
- `new_ecommerce_partner` — add supplier
- `payment_terms_to_br8_tab` — sync payment-terms master

Plus via j87 dispatch (llprun.exe line 180720+):

- `LIS_CLIENT_FUNCTION` (meta-function: get LL release version, webapp framework version, etc.)
- `UPLOAD_DIBBS_QUOTES` — bulk DIBBS upload (DQUS — Jason's C# service)
- `update_dibbs_password` / `DIBBS_HTTP_DOWNLOAD` / `DIBBS_LOW_PRIORITY_DOWNLOAD`
- `FPDS_ATOM_FEED` — FPDS award feed
- `add_ecommerce_partner`, `add_sally_login`, `add_client_capability`, `partner_function`
- `are_you_listening` — **heartbeat** (takes `e_code` param)
- `is_license_valid`, `is_zip_file_valid`, `FLATTEN_PDF`, `docx_to_text`, `xls_to_pdf`, `word_to_pdf`
- `send_message`, `send_to_distribution_list`
- `get_ip_location`, `tdp_status_update`, `review_response`

### Credentials storage — how to find ours

Credentials live in the database itself, in the generic "any notes" table `kah_tab` joined to `k14_tab` (LL user accounts). The exact join is in llprun.exe at line 542366:

```sql
SELECT ...
FROM k14_tab
JOIN kah_tab ON k14_tab.idnk14_k14 = kah_tab.idnanu_kah
             AND kah_tab.anutyp_kah = 'Sally Credentials'
             AND kah_tab.anutbl_kah = 'k14'
```

The memo field on the kah_tab row contains XML with `<private_key>` (the api_key) and `<public_key>` (the api_secret) tags. **Plaintext — not encrypted at rest.**

Use `scripts/ll-find-sally-credentials.ts` to probe whether ERG already has Sally credentials set up. The script reports counts, per-user status, and the 3-char api_key prefix, but never prints the secrets themselves.

If credentials exist → we can call `api.lamlinks.com/api/llsm/create` from a DIBS API route with the `put_client_quote` function and mostly retire `scripts/redo-bid-with-itmcnt.ts`.

If credentials don't exist → Yosef needs to contact the LL vendor (the son) for API access. The fact that other clients have integrations (`apibeta alan`, `apibeta aerometals`, `apibeta WFL` show up as known hosts in llprun.exe strings) makes this a standard product offering, not a custom ask.

### The `put_client_quote` payload — what fields a quote needs

The exact inner XML schema isn't a string literal (FoxPro builds it per-field via `xml_tag_and_value_to_string` calls inside the caller), but the internal cursor that gathers the fields is fully visible at llprun.exe line 729381. The cursor is called `bsh_tab` ("batch send header"), and it joins 7 source tables to collect every field the API needs:

| Source | Fields | Purpose |
|---|---|---|
| `kd8_tab` | q_time, bidtyp, orefno, qtemal, mfg_pn, valday, fobcod, insmat, acc_sd, qclxml | Core quote record |
| `kda_tab` | dlyaro, qte_ui, qteqty, uprice | **Delivery days, UoM, qty, unit price** |
| `kdh_tab` | q_mode | Quote mode |
| `k34_tab` | mcage, pn_rev, szip | Mfr CAGE + part rev + FOB ZIP |
| `k08_tab` | fsc, niin, p_desc | NSN + description |
| `ka7_tab` | d_code, d_name | DLA/DoD distribution codes |
| `k14_tab` (via xx1 join) | u_name | "Our POC" — the LL user this quote is attributed to |
| terms view | trmdes, dis_pc, disday, netday, trmsid, dla_id | Payment terms (trmsid fetched from "Lamlinks Corp API" — LL calls its own API) |
| memos | a_note, q_note, p_note, m_note | Four free-text fields |

So DIBS's `put_client_quote` wrapper effectively needs to pass the same data we're currently writing to k34/k35. Mapping DIBS pricing + vendor info into this schema is straightforward once we know the exact XML tag names — which will emerge the moment we call `are_you_listening` or `sol_no_to_quote_info` and see a real response (any return payload will use the same `xml_tag_and_value_to_string` element names).

Also interesting: `idnk14_to_sally_credentials` (llprun line 729351) confirms the per-user lookup — LL maps `idnk14_k14` (user ID) to its kah_tab Sally Credentials row. When DIBS calls the API, we attribute the quote to a specific k14 user (probably `ajoseph` or a service account) and use that user's credentials.

### Security finding worth flagging

`api_secret` is stored in plaintext XML in `kah_tab.<memo_col>`. Anyone with `SELECT` on `kah_tab` can read every LL user's key pair. Worth mentioning to Yosef — not a DIBS problem to fix, but ERG should know.

## Newly discovered supporting tables

In the course of the REST API discovery we mapped several more tables worth catalogging:

| Table | Purpose |
|---|---|
| `j87_tab` | Local job queue (VFP-legacy or LLSM-C# processor) |
| `keb_tab` | **Pagination for kdd_tab responses** — when `rspxml_kdd` (capped at 7000 chars) isn't enough, chunks live here ordered by `seq_no_keb`, FK to kdd_tab |
| `kec_tab` | FAR clause reference data (fartyp, farcls, farttl) |
| `kah_tab` | Generic "any notes" — stores Sally Credentials XML, packaging notes, PO header text, FAR clauses per-contract, etc. Keyed by `(anutbl_kah, anutyp_kah, idnanu_kah)` where anutbl is the parent table code ("k14", "k89", "kc4" etc.) |
| `k12_tab` | Entities (`e_code_k12`, e_name, email, fax) — 7-char entity codes |
| `k13_tab` | CAGE codes per entity (entities can have multiple CAGEs) |
| `k14_tab` | **LL user accounts** (`u_name_k14` login, `u_pass_k14` — char(20) suggests plaintext/weak hash) |
| `kde_tab` / `kdf_tab` / `kdg_tab` | Credential authorization log / types / control (added Dec 2017) |

## The state-machine alphabet

Every LL status field follows the pattern `<name>sta_<tbl>` or `<prefix>_stat_<tbl>` with values declared as `#DEFINE` constants. Searchable via `^#DEFINE\s+\w+_?sta[t]?_\w+`. Major state machines:

### Solicitation quote staging (`k33_tab`)
- `o_stat_k33` — offer state: `'adding quotes'` (DoD, staging), `'adding C quotes'` (commercial), `'quotes added'` (finalized)
- `t_stat_k33` — transmit state: `'not sent'`, `'sent'`, `'async send'` (commercial)
- `a_stat_k33` — ack state: `'not acknowledged'`, `'acknowledged'`, `'async ack'` (commercial)
- `s_stat_k33` — **batch show status (o/t/a)**, llprun line 414251 comment: denormalized UI indicator, not an independent fourth state

### Sales orders & shipments
- `k80_tab.rlssta`: `Added`, `Open`, `Closed`, `Cancelled`
- `k81_tab.shpsta`: `Cancelled`, `Not Shipped`, `Shipping`, `Partial Shipment`, `Shipped`, `Over Shipped`, `Open`, `Closed`
- `k81_tab.mrqsta`: `Undefined`, `End Item`, `Assembly`, `Assembly/Buy`
- `kaj_tab.shpsta`: `Packing`, `Shipped`
- `ka8_tab.jobsta`: `New`, `Open`, `Closed`, `Cancelled`
- `ka9_tab.jlnsta`: `Not Active`, `Shipping`, `Assembling`, `Shipped`, `Made`

### POD / receipts
- `k89_tab.podsta`: `Not Sent`, `Sent`, `Acknowledged`, `Pending Review`, `Approved`, `Hold`
- `k89_tab.rcvsta`: `Pending`, `Back Order`, `Completed`, `Cancelled`

### EDI transmission (`kbr_tab.xtcsta`) — the one DIBS needs for invoice/shipment work
- **WAWF 810** (invoice): `WAWF 810 not sent`, `WAWF 810 sent`, `WAWF 810 problem acknowledged`, `WAWF 810 acknowledged`
- **WAWF 856** (advance ship notice): `WAWF 856 not sent`, `WAWF 856 sent`, `WAWF 856 problem acknowledged`, `WAWF 856 acknowledged`
- **WAWF 857** (ship/delivery notice): `WAWF 857 sent`
- **DLA Legacy 810 / 856** (SAMMS): `DLA Legacy 8XX not sent` / `sent` / `problem acknowledged` / `acknowledged`
- **DPMS**: `DPMS not contacted`, `DPMS closeout pending`, `DPMS shipdest completed`

### Invoices / A/R / A/P
- `kad_tab.cinsta` (customer invoice): `Not Posted`, `Posted`, `Voided`
- `ka1_tab.sinsta` (supplier invoice): `Not Posted`, `Posted`, `Voided`
- `kc1_tab.pyasta` (payables): `Imported`, `Voided`, `Posted`
- `kbn_tab.ckosta` (checks): `Not Posted`, `Posted`, `Voided`
- `kbm_tab.cwbsta`: `Adding Checks`, `Checks Added`, `Checks Printed`
- `kbx_tab.m2asta`, `kbz_tab.je1sta`, `kc6_tab.mdrsta`: `unposted`, `posted`, `voided`

### Inspection & inventory
- `k93_tab.instat`: `Pending`, `Accepted`, `Rejected`, `Automatic`
- `kbj_tab.mrbsta`: `Receiving`, `Inventory`
- `kbh_tab.crtsta`: `Uncertified`, `Certified`, `Partly Certified`
- `k95_tab.nnista`: `Importing`, `Inventory`

### Customer-quote pipeline
- `kd8_tab.q_stat`: `Not Sent`, `Retrying`, `Superseded`, `Cancelled`, `Send Failed`, `Quote Sent`
- `kdb_tab.t_stat` (transmission log): `Started`, `Superseded`, `Cancelled`, `Failed`, `Succeeded`

The full set (~200 defines) is greppable from `rev-eng/strings/llprun-strings.txt` with `^#DEFINE\s+\w+_stat_\w+`.

## Database objects catalog (the ones DIBS will touch)

All verbatim DDL is in `rev-eng/strings/llprun-strings.txt`. This is a directory, not a full reference — match-up to our existing `docs/lamlinks-schema/` dump.

| Table | Purpose | Notable columns |
|---|---|---|
| `kdd_tab` | **RPC request queue** | reqfun_kdd, reqxml_kdd, rspxml_kdd (7000 char cap), reqkey_kdd UNIQUE |
| `kea_tab` | **Client Management registry** | a_name_kea (UNIQUE), mgtxml_kea (per-handler config XML) |
| `kdy_tab` | SQL identity/key allocation | replaces legacy IDENTITY columns (6/4/19 migration) |
| `k33_tab` | Quote envelope (staging → posted) | o_stat, t_stat, a_stat, s_stat, itmcnt |
| `k34_tab` | Quote line (vendor + pricing + terms) | 60+ columns including HUBZone, FOB, set-aside flags |
| `k35_tab` | Price detail per line | qty, up, daro (ARO days) |
| `k10_tab` / `k11_tab` / `k08_tab` | Solicitation header / lines / items | sol_no_k10, niin_k08, item-of-issue fields |
| `k81_tab` | Sales order ship quantities | shpsta, pr_num, tcn, fob_od, clnqty |
| `k89_tab` | POD / receipt acknowledgement | podsta, po_dte, por_no, shipin, fob fields |
| `k93_tab` | Inspection records | instat, FK to kbb (inspection batch) |
| `kad_tab` | Customer invoice header | cinsta, cinnum, nine money fields for AR |
| `ka1_tab` | Supplier invoice header | sinsta, sinnum, eight money fields for AP |
| `kaj_tab` | Shipment records | shpsta, bolnum, trakno, edi_id, wawuid |
| `kbr_tab` | **EDI transmission tracking** | xtcsta, xtcscn (scenario: 810/856/857/DPMS), FK to kap |
| `kd8_tab` | Customer-facing quotes (non-DLA) | q_stat, q_clas, qstext, qclxml |
| `kdb_tab` | Quote transmit audit log | FK to kd8, t_clas (API/Fax), t_stat, t_comp |
| `kdn_tab` | RFQ async transmission log | t_comp |
| `kdx_tab` | Individual email control | e_stat |

## The cursor-update-conflict error, fully explained

LL's VFP code updates `k33_tab` through an ODBC cursor with **optimistic concurrency**. When DIBS's worker (or another LL user on an adjacent PC) bumps the row version between the cursor's FETCH and its positioned UPDATE, SQL Server's standard cursor machinery throws `Update conflict in cursor '_9999XXX'`.

This is not a LamLinks bug. It's inherent to how every VFP-to-SQL-Server app built before 2015 works, well-documented on FoxPro forums going back 20 years. There is no server-side fix — no trigger, no proc, no schema change eliminates it. Only client-side coordination (write-only-to-quiet-envelopes, piggyback-only mode, or accepting cosmetic errors) can reduce the race.

**Transmission succeeds regardless.** LL's client has an internal 6-second cursor retry that re-runs the update, which almost always succeeds on the second pass. DLA itself de-dupes via supersede. The error message is cosmetic; the bid ships.

Avoidance for DIBS: write-back via `kdd_tab` RPC (once verified) instead of direct cursor writes. The bot's VFP code can open the cursor, serialize k33/k34 updates through LL's own code path, and absorb retries internally — we never see the conflict.

## DIBS integration path (corrected)

The REST API discovery completely changes the recommended path. The integration plan is now much simpler:

### Step 1 (immediate, zero risk) — check if ERG already has Sally credentials

Run `scripts/ll-find-sally-credentials.ts`. The script:
- Probes `kah_tab` for rows with `anutyp_kah='Sally Credentials'` joined to `k14_tab`
- Reports per-user status (login, memo size, presence of `<private_key>`/`<public_key>` tags, 3-char api_key prefix)
- Never prints the actual secrets

Two outcomes:
- **Rows exist** → we skip ahead to step 3. Yosef probably knows about these already.
- **No rows** → step 2.

### Step 2 (if no credentials) — request API access

Ask Yosef to contact the LL vendor (the son) for Sally API credentials. Known external clients include `apibeta alan`, `apibeta aerometals`, `apibeta WFL` — so this is a standard product offering, not a custom ask. Expected prefix for new customer keys: `7Lx`.

### Step 3 — heartbeat test

Write `scripts/ll-rest-ping.ts` that calls the `are_you_listening` function via HTTP Digest to `api.lamlinks.com/api/llsm/create`. Confirms credentials work, API is reachable from our network, digest auth is happy.

### Step 4 — read-side proof of concept

Call `get_awards_by_contract_url` or `sol_no_to_quote_info` to pull a known record. Validates the request/response XML shape against real data. This replaces the need to decode VSE handler XML by grep.

### Step 5 — quote write replacement

Build `scripts/ll-rest-put-client-quote.ts` wrapping `put_client_quote`. Replace `scripts/redo-bid-with-itmcnt.ts` for all new quote writes. Cursor-update conflicts disappear from our codebase forever.

### Step 6 — invoice + shipment tracker

Separately, build a DIBS page surfacing `kbr_tab` (WAWF/EDI scenarios), `k89_tab` (POD), `kaj_tab` (shipments). No API needed — these are read-only observations of external state change. This addresses Abe's daily time leak chasing PO + invoice status.

### Fallback — if REST doesn't pan out

If `api.lamlinks.com` isn't reachable from our network or credentials aren't available:
- **Path B**: insert into `j87_tab` directly. Requires the local LLSM (C#) or LIS (VFP) bot to be running. Same function catalog as REST.
- **Path C**: kdd_tab Client Management. Read-only for the handlers we've decoded; write path via `vse_solxml_to_db_update` unverified. Use only as a last resort.

## Methodology — how to extend this

All the above came from string extraction of `llprun.exe` using Sysinternals `strings64.exe`:

```powershell
strings64.exe -accepteula -n 6 llprun.exe > llprun-strings.txt
```

32 MB of text output. The important patterns:

- `^#DEFINE\s+<name>\s+<value>` — every literal constant, including status values, RPC function names, system names, URLs
- `^CREATE TABLE dbo\.<name>` — complete DDL for every table the installer creates
- `^(PROCEDURE|FUNCTION)\s+<name>` — function/procedure boundaries (used for indexing code regions)
- `xml_tag_and_string_to_value\('<tag>'` — XML element names consumed by a handler
- `xml_tag_and_value_to_string\('<tag>'` — XML element names produced by a handler
- Mixed ASCII/UTF-16: Sysinternals extracts both. Wide strings appear character-spaced in the output (e.g. ` p r o c e s s _ v s e _ `). Grep patterns that don't account for this will miss hits inside compiled function bodies. Work around by searching for the ASCII "#DEFINE" copy of the same constant, which is usually present as metadata in the same file.

What string extraction does NOT give us: control flow, conditional branches, which function calls which, argument passing. For that we'd need ReFox (commercial VFP decompiler) — currently blocked by SentinelOne at work and consumer AV at home. Possible future workarounds: Azure VM without EDR, a clean personal laptop, or an IT exclusion. Not attempted yet.

## Open questions (pared down after the REST API discovery)

Most of the original open questions were made moot by finding the REST API. What's left:

1. **Does ERG already have Sally credentials?** Unblocks the whole plan. Answerable in 30 seconds via `scripts/ll-find-sally-credentials.ts`.

2. **Is `api.lamlinks.com` reachable from ERG's network?** Need to confirm outbound HTTP to port 80 works from whatever host runs DIBS scripts. Check with `scripts/ll-rest-ping.ts` once credentials are in hand.

3. **Exact XML payload for `put_client_quote`.** Have the function name and the caller interface (QUOTES_XML_INP + API auth). Don't have the expected inner XML schema. Three ways to resolve:
   - Grep llprun.exe more carefully for `put_client_quote started.` + surrounding XML tag literals
   - Call `are_you_listening` and inspect error messages for any schema hints
   - Ask Yosef / LL vendor for API docs
   - Observe a real invocation via XEvents if we find LL's own client calls this internally

4. **What does LLSM (the C# service) process vs what llprun.exe processes?** Function splits between `reqsys_j87='LIS legacy'` (VFP) and `reqsys_j87='LLSM'` (C#) are spread through the strings. We know LLSM handles DIBBS scraping, PDF extraction, and DIBBS-quote upload. Whether `put_client_quote` is LLSM or VFP determines which service has to be running. Not a blocker — both are operational in ERG's environment.

5. **Is `vse_solxml_to_db_update` still interesting?** Probably not, now that we have the REST path. Leave it on the back burner unless the REST path falls through.

## Previously written memory + scripts index

- Memory: `reference_lamlinks_architecture.md`, `reference_ll_kdd_rpc_bus.md`, `reference_llk_database.md`, `feedback_ll_cursor_errors.md`, `project_lamlinks_writeback.md`
- Related docs: `docs/lamlinks-writeback.md`, `docs/lamlinks-collision-2026-04-21.md`, `docs/sql-profiler-for-invoice-post.md`
- Scripts touching LL:
  - Diagnostics: `who-talks-to-llk.ts`, `find-ll-procs-aggressive.ts`, `all-dbs-object-counts.ts`, `find-ll-proc-across-dbs.ts`, `ll-list-agent-jobs.ts`, `dump-lamlinks-schema.ts`
  - Tracing: `trace-ll-client.ts` (XEvents — can capture live SQL, including kdd_tab inserts when someone exercises the RPC from the WebApp)
  - Envelope handling: `ll-list-my-envelopes.ts`, `inspect-ll-envelope.ts`, `ll-mark-envelope-sent.ts`, `ll-retire-envelope.ts`, `ll-extract-to-temp.ts`, `ll-move-k34-lines.ts`, `ll-remove-k34-line.ts`, `ll-nuke-envelope.ts`
  - Write-back: `redo-bid-with-itmcnt.ts` (the canonical cursor-write-back pattern)
  - TBD: `ll-rpc-pull-status.ts`, `ll-rpc-post-quote.ts` (to be written once open questions are resolved)

## Changelog

- 2026-04-23 (early) — initial writeup covering kdd_tab, VSE handlers, state machines, DB tables, cursor-conflict explanation.
- 2026-04-23 (later, same day) — deeper grep pass uncovered the HTTP REST API (`api.lamlinks.com`), LLSM (the C# service), `j87_tab` (local job queue), and credential storage in `kah_tab`. Integration path rewritten: REST call to `put_client_quote` now the recommended write surface, with `kdd_tab` Client Management demoted to Path C. Added `scripts/ll-find-sally-credentials.ts` to probe for existing credentials. Several "open questions" resolved or obsoleted by the new path.
- 2026-04-23 (evening) — decoded the `<Request>`/`<Response>` envelope shape (common to all REST functions), and the 7-table join `bsh_tab` cursor that shows every field a `put_client_quote` payload needs. DIBS's integration is now mappable end-to-end — the only remaining unknown is the exact lowercase tag names inside `req_data` (resolvable by calling a read function once and inspecting the response).
- 2026-04-23 (night) — ran live credential probe + HTTP test against `api.lamlinks.com`. **Key correction**: the memo column is `a_note_kah` (not `anunte_kah`), and the credential shape is `<sally_credentials><sally_password>NNNN</sally_password><sally_login>email@domain</sally_login></sally_credentials>`. All 24 LL users have rows (dated 2015-12-10, never updated), `sally_password` matches each user's `k14.u_pass_k14` login password (length-verified). **Confirmed**: api.lamlinks.com responds (Apache + ZendServer, Digest realm `API_TEST`), but `(email:password)` auth fails 401 — the `api_key` component is required and is NOT in llk_db1. The api_key + api_secret are almost certainly stored per-workstation in `LLPro.ini`. Also: `j87_tab` does not exist in llk_db1 — it's either in a different DB or a local VFP .dbf file — so the "insert into j87_tab" fallback is not available to DIBS. Security findings logged: passwords stored plaintext in two places (k14_tab + kah_tab), 6 users still have initial-setup password "1234".
