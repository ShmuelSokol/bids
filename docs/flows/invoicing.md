# Flow: Invoicing

Two distinct things live under "invoicing" in DIBS, and they are NOT the same:

1. **EDI 810 to DLA / WAWF** — already built at `/invoicing`. This invoices the *government* for goods we shipped. Output: an X12 810C file the user pastes into Mil-Pac VAN. No LamLinks writes.
2. **LamLinks internal invoice posting (ka8→kae chain)** — NOT built yet. This is the step Yosef wants DIBS to drive: write rows to LamLinks' own invoicing tables so the LamLinks client sees a posted invoice without anyone clicking through the desktop app. Mirrors what the bid-chain write-back (`scripts/generate-bid-insert-sql.ts`) does for bids.

The rest of this page is about #1. #2 is detailed in [LamLinks internal invoicing](#lamlinks-internal-invoicing-yosef-test).

Generate EDI 810 files for government invoicing (WAWF via Mil-Pac VAN). Import DLA payment remittances.

## Entry points

| Path | Purpose |
|------|---------|
| `/invoicing` | Dashboard — select awards, generate EDI 810, copy/download, import remittance |
| `POST /api/invoices/generate-edi` | Main generator |
| `POST /api/edi/parse` | Parse incoming EDI (for debugging/testing) |
| `POST /api/remittance/parse` | Parse DLA payment remittance file (CSV/tab-delimited) |

## Pipeline

```
[Award arrives in LamLinks k81_tab → synced to awards table]
       │
       ▼
[User opens /invoicing]
  Loads awards from Supabase (cage=0AG09, last ~90d)
       │
       ▼
[User selects awards + fills ship-to details (pre-filled)]
       │
       ▼
[Click "Generate EDI 810 (N)"]
  POST /api/invoices/generate-edi
  Body: { invoices: [...], download?: boolean }
       │
       ▼
[edi-generator.ts builds X12 4010 810C transactions]
  - ISA envelope, GS group, ST transaction
  - BIG (invoice metadata), REF (contract), DTM (dates), N1 (ship-to)
  - IT1 lines (item detail)
  - TDS (total), CTT (count)
  - SE/GE/IEA closers
       │
       ▼
[Return as JSON or downloadable .edi file]
       │
       ▼
[User manually uploads to Mil-Pac VAN portal / SFTP / pastes into third-party]
  ← NO AUTOMATIC TRANSMISSION
       │
       ▼
[DLA processes invoice, pays via wire ~3x/month]
       │
       ▼
[User receives DLA remittance file (email or download)]
[User pastes into remittance import textarea]
  POST /api/remittance/parse
  Body: { text, wireDate, wireReference }
       │
       ▼
[Parse CSV/tab lines → { wireDate, totalAmount, matchedCount, unmatchedCount, lines }]
  ← Matching uses HARDCODED MOCK LOOKUP (src/app/api/remittance/parse/route.ts:19-28)
```

## User actions

| Element | Result |
|---------|--------|
| "From / To" date inputs | Filter awards by award_date |
| Award row checkbox | Toggle selection |
| "Select All Visible" | Select up to N awards |
| Ship-to address fields | Pre-filled to DLA Distribution, NC PA |
| "Generate EDI 810 (N)" | `POST /api/invoices/generate-edi` |
| Download .edi button | Download returned text as file |
| Copy to Clipboard | Copy EDI text |
| "Import Remittance" toggle | Show textarea |
| Remittance submit | `POST /api/remittance/parse` |

## API routes

### `POST /api/invoices/generate-edi`

- Body:
  ```ts
  {
    invoices: Array<{
      invoiceNumber: string,   // 7-char gov format (see invariants)
      invoiceDate: string,
      contractNumber: string,
      contractDate: string,
      shipToName, shipToAddress, shipToCity, shipToState, shipToZip, shipToDodaac,
      lines: Array<{ nsn, description, quantity, unitPrice, extendedAmount, uom }>
    }>,
    download?: boolean
  }
  ```
- Returns JSON `{ success, invoiceCount, ediContent, submissionOptions }` OR downloadable `.edi`.
- **Does NOT write to Supabase.** No `invoices` table insert. Only returns text.

### `POST /api/edi/parse`

- Body: `{ edi: string }`
- Returns parsed structure for debugging.

### `POST /api/remittance/parse`

- Body: `{ text: string, wireDate: string, wireReference: string }`
- Returns: `{ wireDate, wireReference, totalAmount, totalCredits, totalDeductions, netAmount, lineCount, matchedCount, unmatchedCount, lines, unmatched }`
- **Matches against a hardcoded map of 8 sample invoice numbers** (lines 19-28). Production needs dynamic lookup.

## Supabase tables

### Read

- `awards` (cage=0AG09, 90-day window) — source of invoice line data
- `sync_log` — for "invoice_generated" action history

### Written

- `sync_log` — enterprise action="invoice_generated" (from page.tsx:45)
- **None else.** Generated EDI content is ephemeral — no persistence.

### Implied (not yet deployed)

- `invoices` — referenced in remittance matching logic but table doesn't exist
- `remittance_records` — would hold parsed remittance data

## External systems

| System | Role |
|--------|------|
| **WAWF** (Web-based Automated Forced Fulfillment) | Gov invoice submission portal |
| **Mil-Pac VAN** (~$40/mo) | Third-party EDI service bureau → GEX → WAWF |
| **GEX** | Government Exchange EDI network |
| **ftpwawf.eb.mil** | Direct SFTP (requires DD2875 + JITC; may not onboard new vendors) |
| **DFAS** | Defense Finance — processes invoices, wires payment |
| **DLA** | Receives goods, sends remittance file |

No automated transmission — user manually uploads to Mil-Pac portal.

## Business invariants

1. **7-char gov invoice number format** (`stripToGovFormat` in `src/app/invoicing/invoicing-dashboard.tsx:58-67`)
   - First line of contract → digits + padding + `0` suffix (e.g., `0000001`)
   - Multi-line: line 2 → `A`, line 3 → `B`, etc. (suffix replaces last digit)
2. **Ship-to hardcoded** — DLA Distribution, Receiving Dock, New Cumberland PA 17070, DODAAC W25G1U.
3. **Our CAGE = `0AG09`**. EDI company name = `"ERG SUPPLY"`.
4. **Payment timing** — DLA pays ~3x/month; Fast Pay contracts (<$35K) within 15 days; standard Net 30.
5. **Receiving delays** — small depots may block payment until receiving confirmation.
6. **EDI version**: X12 4010, transaction set 810C (invoice).

## Known gaps / TODOs

- **No automatic EDI transmission** — user manually uploads to Mil-Pac. Could save 35-45 min/day.
- **Remittance matching is hardcoded mock** — 8 sample invoice numbers only. Needs dynamic `invoices` table lookup.
- **No database write on invoice generation** — `/api/invoices/generate-edi` returns text but doesn't persist. `sync_log` logs the action but the EDI content isn't stored anywhere.
- **EDI archive is ephemeral** — once the user closes the tab, the generated EDI is gone unless they downloaded it.
- **No 997 (Functional Acknowledgment) parsing** — can't confirm WAWF receipt automatically.
- **No `invoices` or `remittance_records` tables deployed** — scaffold only.
- **Ship-to address is hardcoded** — can't vary by contract or depot.
- **Invoice number generation isn't unique-checked** — if two sessions generate the same number, EDI conflicts downstream.
- **No partial-shipment support** — invoice assumes full quantity shipped.
- **No credit-note (812) support** — only forward invoices (810).

## Referenced files

- `src/app/invoicing/page.tsx` — data fetch + dashboard render (58-71)
- `src/app/invoicing/invoicing-dashboard.tsx` — UI (77-533), gov invoice format helper (58-67), EDI generation call (150-203)
- `src/app/api/invoices/generate-edi/route.ts` — EDI route (12-56)
- `src/app/api/edi/parse/route.ts` — parse incoming EDI
- `src/app/api/remittance/parse/route.ts` — remittance parse (mock lookup 19-28)
- `src/lib/edi-generator.ts` — X12 810C builder (14-177; company name at 54)
- `src/lib/edi-parser.ts` — X12 parser (80-177)
- `src/lib/remittance-parser.ts` — remittance format parser (54-130)

## LamLinks internal invoicing (Yosef test)

Not live. This section is the recon and plan; the write-back tooling is not yet built.

### The chain

```
ka8_tab  (Job / order header)
   │   FK idnka8_ka8
   ▼
ka9_tab  (Job line)  ──► idnk81_ka9 → k81_tab      (the DLA award being fulfilled)
   │                  ──► idnkaj_ka9 → kaj_tab     (the shipment that satisfied this line)
   │   FK idnkae_ka9
   ▼
kae_tab  (Invoice line)
   │   FK idnkad_kae
   ▼
kad_tab  (Invoice header)
```

A posted invoice requires ALL four parents to exist first. **DIBS cannot skip them** — there is no "just invoice" entry point in the schema. A ka9 row insists on FKs to ka8, k81, kae, AND kaj (all NOT NULL).

### Findings from `scripts/reverse-engineer-invoice-schema.ts`

Ran against 50 most recent `cinsta_kad = 'Posted'` invoices. Key observations:

- **`cinsta_kad` (state field)**: 3 known values — `'Posted'` (253K), `'Not Posted'` (44), `'Voided'` (2). `'Not Posted'` is the likely draft state for a DIBS-created invoice.
- **`upname_kad = 'ajoseph'`** on every sampled invoice, while `upname_ka9 = 'warehouse2'` on every sampled order line — a **two-role split**: the warehouse operator creates ka8/ka9/kaj during fulfillment, and Abe posts kad/kae at invoice time. So DIBS' safest scope is the invoice-posting half (kad + kae + UPDATE ka9 to link `idnkae_ka9`), not the full chain.
- **No stored procs, no triggers** on any of the 5 tables — same dumb-schema pattern as the bid chain. Posting must therefore happen in the LamLinks client app code, not the DB.
- **kad_tab is small**: 20 columns, 5 auto (PK + timestamps + user), 2 FKs constant in the sample (`idnk31_kad=203`, `idnk06_kad=1` — likely customer + org), 2 user-entered (`cin_no_kad`, `cinnum_kad` invoice numbers), 2 value fields (`mslval_kad`, `ar_val_kad`), 9 hardcodable zeroes.
- **kae_tab is smaller**: 13 columns, 4 auto, 1 FK, 4 constants (`cilcls_kae='Material'`, `cil_no_kae=1`, `pinval_kae=0`, `xinval_kae=0`), 4 variable (`cildes_kae`, `cilqty_kae`, `cil_up_kae`, `cil_ui_kae` = EA/PG/PK/BX, `cilext_kae`).

### Questions answered from SQL (2026-04-22)

Q1-Q5 from an earlier list (see git history) were answered by `scripts/answer-invoice-questions.ts` without needing Yosef:

1. **`cinsta_kad` state machine**: "Posted" (253,695), "Not Posted" (44, mostly abandoned drafts), "Voided" (2). `Not Posted` IS the draft state but is rarely used actively. Transition is an in-place UPDATE on the same row; `uptime_kad` bumps when state flips while `cisdte_kad` stays put as the create timestamp.
2. **`upname_kad` is purely audit** — many users over time (ajoseph, jmogitz, tbellamy, caugustin, warehouse2, shippingii, etc.). No posting logic filters on it. DIBS can write `'ajoseph   '` or the logged-in user.
3. **`idnk31_kad` varies per DLA sub-agency**. idnk31=203 ("DoD", a_code=96412) is the generic 115K-invoice default. 100+ other k31 rows exist for specific activity codes (SPM2DS, SPE4A0, SPE2DP, etc.). **DIBS must look up the right idnk31 per invoice based on the contract's 6-char DLA prefix** (fall back to 203 if no exact match).
4. **`idnk06_kad` is payment terms**, not company/org. idnk06=1 ("Net 30 days") is used on 238K/253K invoices. Others: 109=Net 0, 5=1%10-Net-20, 110=Net 15, 111=Net 10. **DIBS default = 1 (Net 30)** unless contract specifies otherwise.
5. **`ar_val_kad = mslval_kad = sum of line extensions`** on 30/30 sampled Posted invoices. Every other value field (pinval, xinval, nmsval, cshval, crmval, otcval, ppcval) was 0. ERG doesn't use the multi-component fields. **DIBS sets `mslval_kad = ar_val_kad = sum of cilext_kae` across all lines**; zero the rest.

### CRITICAL: invoice-chain id allocation is NOT via kdy_tab

While answering Q1-Q5 we discovered the ka-chain tables (`ka8`, `ka9`, `kad`, `kae`, `kaj`) all use **SQL Server `IDENTITY` columns** — seed=1, increment=1, no `kdy_tab` entry. Different mechanism from the bid chain (`k33/k34/k35`) which relies on `kdy_tab`.

**What this means for the write-back**:

```sql
-- Don't specify the PK column. MSSQL auto-allocates atomically.
INSERT INTO kad_tab (cinsta_kad, cin_no_kad, cinnum_kad, idnk31_kad, idnk06_kad, mslval_kad, ar_val_kad, ...)
OUTPUT inserted.idnkad_kad  -- returns the auto-generated id
VALUES ('Not Posted      ', '...', '...', <k31>, 1, <total>, <total>, ...);
```

No collision possible — `IDENTITY` is a serializable sequence managed by the DB engine. Simpler than the bid chain.

### Questions still needing Yosef (2 instead of 7)

6. **Does AX read directly from `kad/kae`, or is there an intermediate integration?** When `cinsta_kad` flips to `'Posted'`, what downstream system picks it up (if any)? Or is this LamLinks-internal accounting with no external propagation?
7. **What does the "Post" action do exactly?** Most likely: `UPDATE kad_tab SET cinsta_kad = 'Posted'` + `UPDATE ka9_tab SET idnkae_ka9 = <new kae id>` to link the job line to the invoice. But confirm — any side effects (file drop, email, external API)? Best captured by having Yosef walk through one real invoice posting in LamLinks while we tail the relevant tables live.

### Original 7-question list (pre-investigation)

### Proposed phased path (updated 2026-04-22)

1. **Phase 0 (done):** schema mapped + field classifications produced.
2. **Phase 1a (done):** Q1-Q5 answered from SQL inspection. See `scripts/answer-invoice-questions.ts`. Also discovered ka-chain uses IDENTITY not kdy_tab — huge simplification for the write-back.
3. **Phase 1b (pending):** 20-min Yosef session. Walk through one real invoice posting in the LamLinks UI while tailing `kad_tab`, `ka9_tab`, `kae_tab` live. Answers the remaining Q6/Q7 (AX integration path + exact "Post" action) in one pass.
4. **Phase 2:** build `scripts/generate-invoice-insert-sql.ts` as a dry-run generator. Inputs: selected DIBS invoices (from an `invoices_to_post` Supabase table or the existing /invoicing UI). Outputs: INSERT SQL for kad + kae + UPDATE ka9.idnkae_ka9. Uses `IDENTITY` auto-allocation (just omit PK columns in INSERT, grab id via `OUTPUT inserted.idnkad_kad`). Insert at `cinsta_kad='Not Posted'` so Yosef still has the UI Post step as a human checkpoint.
5. **Phase 3:** pick ONE real shipment, use the generator end-to-end with Yosef watching. If the row appears in LamLinks UI exactly as if he'd typed it, contract is met.
6. **Phase 4:** scale up. Add it to the DIBS `/invoicing` UI as a "Post to LamLinks" button alongside the existing EDI generation.

**Don't skip Phase 1b.** We still don't know what the LamLinks client does beyond UPDATE cinsta_kad. 20 minutes with Yosef + live DB tail saves weeks of trial-and-error.

### Referenced scripts

- `scripts/test-invoice-chain.ts` — initial schema/FK reconnaissance
- `scripts/reverse-engineer-invoice-schema.ts` — column-by-column classification of 50 posted invoices + state-field probe
