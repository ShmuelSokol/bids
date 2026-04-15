# Flow: AX Sales Order Write-Back (via MPI, not DMF)

**Status**: not built. Decision locked 2026-04-15 (see `docs/meeting-2026-04-15.md`).

## Architecture

DIBS does NOT generate a sales order DMF workbook. Yosef's existing MPI Sales Order page in Dynamics has years of business logic baked in (contract grouping, DODAAC → address_id resolution, CLIN/TCN handling, NSN → item lookup with UoM conversion). DIBS' job is to:

1. Auto-download the LamLinks awards file (stops Abe going to Desktop)
2. Pre-validate the file against AX: every DODAAC mapped? every NSN matches an item with a valid UoM conversion?
3. Surface errors in DIBS for Abe to fix upstream (faster feedback loop than AX's import-then-see-errors UX)
4. Hand the pre-cleaned file back to Abe; he uploads to the same MPI Sales Order page unchanged
5. MPI creates the SOs. We poll AX for the new SO numbers and display.

## What Yosef's MPI does (we don't replicate)

- Strips partial-day awards (today's date always excluded so re-runs don't re-process)
- Reads the file: contract number, release number, NSN, part number, qty, price, FOB, DODAAC
- Groups rows by `(contract_number, address_id)` where `address_id = lookup(DODAAC)`. Same contract + same address → single SO header. Same contract but different addresses → multiple SOs.
- Customer PO number on the SO = contract number
- For each line: NSN lookup in AX barcode table returns `ItemNumber` + UoM (with multiples via B3/B4/B5/B6 codes on the barcode page's quantity field)
- Line gets a CLIN + TCN number (Transportation Control Number)
- Failed lookups surface as per-line errors in MPI (currently a workflow that pre-populates error lines with NSN + suggested item number)

## DODAAC lookup

- DODAAC (Department of Defense Activity Address Code) = government's GLN equivalent. A single physical address identifier.
- In AX under the DD219 customer account there's a DODAAC → address_id mapping table.
- Many DODAACs can point to the same address_id (consolidation because of our medical ship rules).
- Missing DODAAC → Abe adds it by going to bottom of the DODAAC list, clicking New, pasting `(DODAAC, address_id)`. Can add 100 at a time by pasting a range. No DMF needed.
- Adding a new address_id = free-text title → AX assigns the ID (same pattern as auto-numbered PO).

## NSN lookup + UoM conversion

- AX barcode table maps NSN → ItemNumber
- Each item in AX has a UoM conversion table: EA, B3 (= 3 each), B4, B5, B6, etc.
- **B3 must be defined per item as "how many EA"** — SO validation fails if the item references B3 but has no conversion row
- When DIBS reports "NSN not in AX", it can be:
  - Item exists, NSN not yet linked → Abe attaches NSN to existing item
  - Item doesn't exist → Abe creates new item via NPI first
  - Two NSNs for one item (government lists two for the same SKU) → Abe attaches both NSNs to same item

## DIBS pre-validation steps

For each award in the file:

1. **DODAAC check**: does `(DODAAC, DD219 customer)` resolve to an address_id in AX?
   - Yes → OK
   - No → show in DIBS error list. Abe either adds the DODAAC→address_id map in AX UI or chooses an existing address.
2. **NSN match check**: does the NSN exist in AX's barcode table with a valid UoM conversion?
   - Yes → OK
   - No → show in DIBS error list. Abe creates item (NPI) or attaches NSN to existing item.

Only surface as errors; don't block the file. Abe resolves in AX, re-runs DIBS validation, exports file when clean.

## Downstream: after SOs exist

Abe's workflow post-SO-creation:
1. Opens AX Sales Orders page, filters to today
2. Per SO line: checks stock. If in stock → emails warehouse. If not → creates PO (separate PO-write-back flow)
3. Stock evaluation rules (this is where it gets fuzzy):
   - Free stock OK to commit
   - Stock in shipping location → already assigned, can't use
   - Stock in DD219 location → already assigned (picker put it there for another order)
4. All this is done in AX, not DIBS. DIBS just needs to have gotten the SO in.

## State transitions DIBS tracks

On the DIBS side per award:

- `ready_for_validation` — award just came in from nightly k81 import
- `validation_errors` — DODAAC or NSN unresolved; Abe must fix in AX
- `ready_for_mpi` — all pre-checks green; Abe can upload the file
- `mpi_in_progress` — Abe has uploaded; MPI batch running
- `so_created` — DIBS polled AX and saw the SO exists for this award
- `mpi_rejected` — the file was uploaded but MPI returned errors DIBS didn't catch

## Still needs from Yosef

- A sample awards file from LamLinks so we can confirm column layout + how partial-day stripping works
- Confirmation on: when DIBS queries AX for a newly-created SO, what's the best key to match back to our award? (contract_number + CLIN should be unique)
- Whether AX's SO has a field we can stamp with our DIBS award ID for correlation

## Related flows

- `docs/flows/ax-po-writeback.md` — the PO side (totally separate write path, different AX entities)
- `docs/flows/awards-to-pos.md` — the original awards→POs flow, predates this SO split
- `docs/meeting-2026-04-15.md` — the decisions that locked this architecture in
