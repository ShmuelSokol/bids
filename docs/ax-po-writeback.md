# AX Purchase Order Write-Back

Once awards are routed to the right supplier and a draft PO looks good in DIBS, pushing it to Dynamics (AX) is a two-step DMF import with a poll in the middle. DIBS generates the Excel files, the operator uploads them to AX's Data Management workspace, and DIBS watches for each step to complete.

## The three-stage flow

```
DIBS draft PO                                      AX
─────────────                                      ──
drafted
   │  "Submit Headers" (bulk or single)
   │  → generates header xlsx with VendorOrderReference correlation tag
   ▼  → operator uploads to DMF "PO Header" project
awaiting_po_number
   │  "Check AX" (polls PurchaseOrderHeadersV2?$filter=VendorOrderReference eq ...)
   │  → reads back assigned AX PO#, writes to purchase_orders.ax_po_number
   ▼
lines_ready
   │  "Submit Lines" (bulk or single)
   │  → generates lines xlsx with the assigned PO# + sequential line numbers
   ▼  → operator uploads to DMF "PO Lines" project
awaiting_lines_import
   │  "Check AX" (polls PurchaseOrderLinesV2?$filter=PurchaseOrderNumber eq ...)
   │  → confirms line count matches DIBS line count
   ▼
posted
```

After `posted`, the operator opens the PO in AX and clicks **Send Confirmation** — Dynamics emails the PDF to the vendor using its stored address. DIBS doesn't re-implement vendor transmission.

## When NPI is required first

If any line's NSN isn't in `nsn_catalog`, or the vendor isn't in `nsn_ax_vendor_parts` for that NSN, the AX writeback will fail on the lines import — AX won't know the item yet. DIBS surfaces this with a "Generate NPI" button on the affected PO card. The NPI flow is separate and documented in the [NPI Workflow](/wiki/npi-workflow) page.

Operator runs NPI, Yosef imports it, DIBS polls AX to notice the items landed, then the regular header→lines flow proceeds.

## Bulk actions

The POs tab supports selecting multiple POs and acting on all of them at once:

- **Generate NPI** — one combined workbook covering every selected PO
- **Submit Headers** — bulk header DMF push
- **Submit Lines** — bulk lines DMF push (requires each PO already in `lines_ready`)
- **Check AX** — poll for state transitions across all selected POs
- **Download ZIP** — header + lines + NPI xlsx bundled per PO
- **Delete** — only affects POs still `drafted` / null `dmf_state`; AX-committed POs are filtered out safely

## State recovery

DIBS never deletes an AX PO. If a DMF import fails partway:

- Header import failed → PO stays `drafted`, operator re-runs Submit Headers
- Lines import failed → PO stays in `lines_ready` (AX has the header but no lines), operator re-runs Submit Lines
- Mismatched line count → "Check AX" will not advance to `posted`; operator investigates in AX

## Files + APIs

Full technical details — entity lists, field mappings, working assumptions, open questions for Yosef — live at `docs/flows/ax-po-writeback.md`. The API route list and Supabase schema additions are in `docs/flows/awards-to-pos.md`.
