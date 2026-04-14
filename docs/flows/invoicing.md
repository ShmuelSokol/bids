# Flow: Invoicing

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
