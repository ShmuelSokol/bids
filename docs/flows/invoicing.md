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

### Questions for Yosef (from the script output)

1. `cinsta_kad` — does `'Not Posted'` mean what we think (draft shown in LamLinks UI, not yet transmitted to AX)? What's the transition trigger?
2. `upname_kad` — is this just an audit field, or does LamLinks' posting logic filter on it?
3. `idnk31_kad=203` constant — that's the customer FK to k31_tab. Is 203 a fixed "ERG DLA" customer, or will it vary?
4. `idnk06_kad=1` — what is k06? (Company / org / something else?)
5. `pinval_kad / xinval_kad / mslval_kad / nmsval_kad / ppcval_kad / ar_val_kad` — which is the authoritative total? Our sample shows `mslval_kad = ar_val_kad` and everything else 0; is that typical or sample-biased?
6. Does AX read directly from kad/kae, or is there an intermediate integration?
7. What IS the "post" action the client calls? Just an UPDATE on `cinsta_kad`?

### Proposed phased path to a Yosef-testable write-back

1. **Phase 0 (done):** schema mapped + field classifications produced.
2. **Phase 1:** Yosef answers the 7 questions above. Without that, any INSERT is a guess.
3. **Phase 2:** build `scripts/generate-invoice-insert-sql.ts` as a dry-run generator mirroring `scripts/generate-bid-insert-sql.ts`. Input: a Supabase `invoices_to_post` table (or a CSV Yosef uploads); output: INSERT SQL for kad + kae + UPDATE ka9. Behind `--execute` flag. Insert at `cinsta_kad = 'Not Posted'` so Yosef still has the UI step to confirm.
4. **Phase 3:** pick ONE real shipment and use the dry-run generator end-to-end with Yosef watching. If the row appears in LamLinks UI exactly as if he'd typed it, the contract is met.
5. **Phase 4:** scale up.

**Do not try to skip phases for the upcoming meeting.** Spend the meeting on Phase 1 (questions) and let him walk through one recent invoice end-to-end in the LamLinks UI while you watch. That conversation is the spec for Phase 2.

### Referenced scripts

- `scripts/test-invoice-chain.ts` — initial schema/FK reconnaissance
- `scripts/reverse-engineer-invoice-schema.ts` — column-by-column classification of 50 posted invoices + state-field probe
