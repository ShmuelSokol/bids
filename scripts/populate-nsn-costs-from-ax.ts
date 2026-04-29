/**
 * Rebuild nsn_costs + nsn_vendor_prices from AX PriceAgreements with
 * unit-of-measure persistence. v1 scope: PriceAgreements only (134K
 * rows). PO-line cost waterfall (Recent PO > Older PO) is v2 — it
 * needs a second query against PurchaseOrderHeaderV2 to get vendor.
 *
 * Why this fixes the bug: nsn_vendor_prices had no UoM, so the PO
 * generator multiplied pack-unit cost × each-unit quantity on award
 * lines. With UoM persisted here, the generator routes UoM-mismatch
 * lines to UNASSIGNED instead of producing negative-margin POs.
 *
 * For each NSN:
 *   - nsn_costs gets ONE row: cheapest vendor + cost_source
 *     ("AX price agreement (cheapest vendor)") + vendor + UoM
 *   - nsn_vendor_prices gets ONE row per known (NSN, vendor) pair
 *
 * ItemNumber → NSN mapping comes from ProductBarcodesV3 where
 * BarcodeSetupId='NSN' (PriceAgreements themselves carry only
 * ItemNumber, not NSN).
 *
 *   npx tsx scripts/populate-nsn-costs-from-ax.ts
 *   npx tsx scripts/populate-nsn-costs-from-ax.ts --dry-run
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { fetchAxPaginated, fetchAxByMonth } from "./ax-fetch";

const DRY_RUN = process.argv.includes("--dry-run");

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365_URL = process.env.AX_D365_URL!;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365_URL}/.default`,
  });
  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const data: any = await resp.json();
  if (!data.access_token) throw new Error("Auth failed: " + data.error_description);
  return data.access_token;
}

async function fetchAllPages(token: string, url: string, label?: string): Promise<any[]> {
  // Uses the shared helper so the AX silent-1000-cap is detected and
  // warned (see scripts/ax-fetch.ts). If we ever hit the cap on a
  // filtered query here, the log will flag it.
  const { rows } = await fetchAxPaginated(token, url, { maxRows: 500000, label });
  return rows;
}

/**
 * Build ItemNumber → NSN map by querying ProductBarcodesV3 directly.
 * The NSN barcodes live there (BarcodeSetupId = 'NSN'); nsn_catalog
 * in Supabase doesn't carry item_number so we can't use it.
 *
 * Returned NSNs are formatted as "FSC-NIIN" to match how we store
 * them elsewhere in the codebase (e.g. "6515-01-153-4716").
 */
async function loadItemToNsnMap(token: string): Promise<Map<string, string>> {
  const all = await fetchAllPages(
    token,
    `${D365_URL}/data/ProductBarcodesV3?cross-company=true&$select=ItemNumber,Barcode,BarcodeSetupId&$filter=BarcodeSetupId eq 'NSN'`,
    "ProductBarcodesV3 NSN"
  );
  const map = new Map<string, string>();
  for (const r of all) {
    const item = r.ItemNumber?.trim();
    const raw = r.Barcode?.trim();
    if (!item || !raw) continue;
    // NSN format: FSC (4) + NIIN (9). Accept with-dashes too.
    const digits = raw.replace(/-/g, "");
    if (digits.length !== 13) continue;
    const nsn = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
    map.set(item, nsn);
  }
  return map;
}

function bucketForPO(deliveryDate: string | null): string {
  if (!deliveryDate) return "AX PO (older)";
  const d = new Date(deliveryDate).getTime();
  const now = Date.now();
  const days = (now - d) / 86_400_000;
  if (days <= 60) return "AX PO (last 2 months)";
  if (days <= 90) return "AX PO (last 3 months)";
  return "AX PO (older)";
}

function sourceRank(src: string): number {
  // Lower = better (cheapest + freshest first)
  if (src === "AX PO (last 2 months)") return 0;
  if (src === "AX PO (last 3 months)") return 1;
  if (src === "AX price agreement (cheapest vendor)") return 2;
  if (src === "AX PO (older)") return 3;
  return 99;
}

type CostCandidate = {
  cost: number;
  source: string;
  vendor: string | null;
  uom: string | null;
  itemNumber: string;
};

async function main() {
  console.log(`=== NSN COST REBUILDER ${DRY_RUN ? "(DRY RUN)" : "(WRITING)"} ===\n`);

  console.log("1. Authenticating to AX...");
  const token = await getToken();

  console.log("\n2. Building ItemNumber → NSN map from ProductBarcodesV3 ...");
  const itemToNsn = await loadItemToNsnMap(token);
  console.log(`   ${itemToNsn.size.toLocaleString()} ItemNumber → NSN mappings\n`);
  if (itemToNsn.size === 0) {
    console.log("No NSN barcodes found — bailing. Check AX entity access.");
    return;
  }

  // 3a. Pull PO line history — actual transacted costs with real vendors.
  // This is the most reliable cost source: if we bought it from vendor X
  // at $19 last month, that's what we should use for the next PO.
  console.log("3a. Pulling PurchaseOrderLinesV2 (actual PO history)...");
  const poLines = await fetchAllPages(
    token,
    `${D365_URL}/data/PurchaseOrderLinesV2?cross-company=true&$select=ItemNumber,PurchasePrice,PurchaseUnitSymbol,RequestedDeliveryDate,PurchaseOrderLineStatus,PurchaseOrderNumber`,
    "PO Lines"
  );
  console.log(`   ${poLines.length.toLocaleString()} PO lines\n`);

  // 3b. Pull PO headers for vendor assignment
  console.log("3b. Pulling PurchaseOrderHeadersV2 (vendor per PO)...");
  const { rows: poHeaders } = await fetchAxByMonth(token, {
    D365_URL,
    entity: "PurchaseOrderHeadersV2",
    dateField: "AccountingDate",
    monthsBack: 12,
    select: ["PurchaseOrderNumber", "OrderVendorAccountNumber", "AccountingDate"],
  });
  console.log(`   ${poHeaders.length.toLocaleString()} PO headers (12 months)\n`);
  const vendorByPo = new Map<string, string>();
  for (const h of poHeaders) {
    if (h.PurchaseOrderNumber && h.OrderVendorAccountNumber)
      vendorByPo.set(h.PurchaseOrderNumber, h.OrderVendorAccountNumber.trim());
  }

  console.log("3c. Pulling PurchasePriceAgreements (asking prices + UoM)...");
  const priceAgreements = await fetchAllPages(
    token,
    `${D365_URL}/data/PurchasePriceAgreements?cross-company=true&$select=ItemNumber,Price,QuantityUnitSymbol,VendorAccountNumber`,
    "PriceAgreements"
  );
  console.log(`   ${priceAgreements.length.toLocaleString()} price agreements\n`);

  // Build candidate buckets per NSN from ALL sources.
  console.log("4. Bucketing by NSN (PO history + price agreements)...");
  const byNsn = new Map<string, CostCandidate[]>();
  const now = Date.now();

  // 4a. PO lines — bucketed by recency
  let poMatched = 0;
  for (const line of poLines) {
    const nsn = itemToNsn.get(line.ItemNumber);
    if (!nsn || !line.PurchasePrice || line.PurchasePrice <= 0) continue;
    // Need the PO number to get vendor — but PO lines don't have it in this select.
    // Use RequestedDeliveryDate for recency bucketing.
    const deliveryDate = line.RequestedDeliveryDate;
    const source = bucketForPO(deliveryDate);
    // Vendor comes from the line's UoM field naming convention or we skip vendor for now
    // and let the price agreement fill it. Actually PO lines don't carry vendor —
    // that's on the header. We'd need PurchaseOrderNumber on the line.
    // For now, use price as cost evidence without vendor assignment.
    // The price agreement step below will provide vendor.
    const vendor = vendorByPo.get(line.PurchaseOrderNumber) || null;
    if (!byNsn.has(nsn)) byNsn.set(nsn, []);
    byNsn.get(nsn)!.push({
      cost: line.PurchasePrice,
      source,
      vendor,
      uom: line.PurchaseUnitSymbol?.trim() || null,
      itemNumber: line.ItemNumber,
    });
    poMatched++;
  }
  console.log(`   ${poMatched.toLocaleString()} PO lines matched to NSNs`);

  // 4b. Price agreements
  for (const p of priceAgreements) {
    const nsn = itemToNsn.get(p.ItemNumber);
    if (!nsn || !p.Price || p.Price <= 0) continue;
    if (!byNsn.has(nsn)) byNsn.set(nsn, []);
    byNsn.get(nsn)!.push({
      cost: p.Price,
      source: "AX price agreement (cheapest vendor)",
      vendor: p.VendorAccountNumber || null,
      uom: p.QuantityUnitSymbol?.trim() || null,
      itemNumber: p.ItemNumber,
    });
  }
  console.log(`   ${byNsn.size.toLocaleString()} NSNs have ≥1 candidate\n`);

  // Pick waterfall winner per NSN for nsn_costs.
  console.log("5. Applying waterfall → nsn_costs...");
  const nsnCostsRows: any[] = [];
  for (const [nsn, cands] of byNsn) {
    cands.sort((a, b) => {
      const r = sourceRank(a.source) - sourceRank(b.source);
      if (r !== 0) return r;
      return a.cost - b.cost; // within same source, cheapest wins
    });
    const winner = cands[0];
    // Compute pack multiplier from UoM (e.g. "B25" → 25). When AX UoM is a
    // bundle, cost_per_each lets pricing logic compare apples-to-apples
    // against per-EA solicitations. See `src/lib/uom.ts`.
    const uomStr = (winner.uom || "").trim().toUpperCase();
    const m = uomStr.match(/^B(\d+)$/);
    const packMult = m ? parseInt(m[1], 10) : 1;
    nsnCostsRows.push({
      nsn,
      cost: winner.cost,
      cost_per_each: packMult > 1 ? winner.cost / packMult : winner.cost,
      pack_multiplier: packMult,
      cost_source: winner.source,
      vendor: winner.vendor,
      unit_of_measure: winner.uom,
      item_number: winner.itemNumber,
      updated_at: new Date().toISOString(),
    });
  }
  console.log(`   ${nsnCostsRows.length.toLocaleString()} nsn_costs rows built\n`);

  // Build nsn_vendor_prices: one row per (nsn, vendor) pair, keeping
  // each vendor's lowest-priced + freshest offer.
  console.log("6. Rolling up vendor alternatives → nsn_vendor_prices...");
  const byNsnVendor = new Map<string, CostCandidate>();
  for (const [nsn, cands] of byNsn) {
    for (const c of cands) {
      if (!c.vendor) continue;
      const key = `${nsn}__${c.vendor}`;
      const existing = byNsnVendor.get(key);
      if (!existing) {
        byNsnVendor.set(key, c);
        continue;
      }
      const existingRank = sourceRank(existing.source);
      const candRank = sourceRank(c.source);
      if (candRank < existingRank || (candRank === existingRank && c.cost < existing.cost)) {
        byNsnVendor.set(key, c);
      }
    }
  }
  const vendorPriceRows = Array.from(byNsnVendor.entries()).map(([key, c]) => {
    const [nsn] = key.split("__");
    const uomStr = (c.uom || "").trim().toUpperCase();
    const mm = uomStr.match(/^B(\d+)$/);
    const packMult = mm ? parseInt(mm[1], 10) : 1;
    return {
      nsn,
      vendor: c.vendor!,
      price: c.cost,
      price_per_each: packMult > 1 ? c.cost / packMult : c.cost,
      pack_multiplier: packMult,
      price_source: c.source,
      unit_of_measure: c.uom,
      item_number: c.itemNumber,
      updated_at: new Date().toISOString(),
    };
  });
  console.log(`   ${vendorPriceRows.length.toLocaleString()} nsn_vendor_prices rows built\n`);

  // 6b. Build po_receipt_history — the last 10 PO entries per NSN so the
  // supplier switch modal shows real purchase history without querying AX.
  console.log("6b. Building PO receipt history...");
  const receiptRows: any[] = [];
  for (const line of poLines) {
    const nsn = itemToNsn.get(line.ItemNumber);
    if (!nsn || !line.PurchasePrice || line.PurchasePrice <= 0) continue;
    const vendor = vendorByPo.get(line.PurchaseOrderNumber);
    if (!vendor) continue;
    receiptRows.push({
      nsn,
      item_number: line.ItemNumber,
      vendor,
      purchase_price: line.PurchasePrice,
      quantity: line.OrderedPurchaseQuantity || null,
      uom: line.PurchaseUnitSymbol?.trim() || null,
      po_number: line.PurchaseOrderNumber,
      delivery_date: line.RequestedDeliveryDate || null,
      line_status: line.PurchaseOrderLineStatus || null,
      updated_at: new Date().toISOString(),
    });
  }
  console.log(`   ${receiptRows.length.toLocaleString()} PO receipt rows with vendor + NSN\n`);

  // Report
  const sourceCounts: Record<string, number> = {};
  for (const r of nsnCostsRows) sourceCounts[r.cost_source] = (sourceCounts[r.cost_source] || 0) + 1;
  console.log("7. Source distribution in new nsn_costs:");
  for (const [s, n] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${n.toString().padStart(6)}  ${s}`);
  }
  const withUom = nsnCostsRows.filter((r) => r.unit_of_measure).length;
  console.log(`\n   ${withUom.toLocaleString()} / ${nsnCostsRows.length.toLocaleString()} have UoM (${Math.round((withUom / nsnCostsRows.length) * 100)}%)`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — skipping writes. Sample of nsn_costs output:");
    console.log(JSON.stringify(nsnCostsRows.slice(0, 3), null, 2));
    return;
  }

  // Truncate + reload. Both tables get fully rebuilt because the old
  // data was 100% price_agreement with no UoM — we don't want to
  // half-merge it with the new shape.
  console.log("\n8. Clearing existing rows...");
  await sb.from("nsn_costs").delete().not("nsn", "is", null);
  await sb.from("nsn_vendor_prices").delete().not("nsn", "is", null);

  console.log("9. Writing nsn_costs...");
  let written = 0;
  for (let i = 0; i < nsnCostsRows.length; i += 500) {
    const batch = nsnCostsRows.slice(i, i + 500);
    const { error } = await sb.from("nsn_costs").insert(batch);
    if (error) console.error(`   batch ${i} error: ${error.message}`);
    else written += batch.length;
  }
  console.log(`   ${written.toLocaleString()} written\n`);

  console.log("10. Writing nsn_vendor_prices...");
  let vWritten = 0;
  for (let i = 0; i < vendorPriceRows.length; i += 500) {
    const batch = vendorPriceRows.slice(i, i + 500);
    const { error } = await sb.from("nsn_vendor_prices").insert(batch);
    if (error) console.error(`   batch ${i} error: ${error.message}`);
    else vWritten += batch.length;
  }
  console.log(`   ${vWritten.toLocaleString()} written\n`);

  // Dedup receipt rows before insert (same NSN+vendor+PO can have
  // multiple lines — keep the one with the highest price as representative)
  console.log("11. Writing po_receipt_history...");
  await sb.from("po_receipt_history").delete().not("nsn", "is", null);
  const receiptDedup = new Map<string, any>();
  for (const r of receiptRows) {
    const key = `${r.nsn}|${r.vendor}|${r.po_number}|${r.delivery_date || ""}`;
    const existing = receiptDedup.get(key);
    if (!existing || (r.purchase_price > existing.purchase_price)) {
      receiptDedup.set(key, r);
    }
  }
  const dedupedReceipts = Array.from(receiptDedup.values());
  let rWritten = 0;
  for (let i = 0; i < dedupedReceipts.length; i += 500) {
    const batch = dedupedReceipts.slice(i, i + 500);
    const { error } = await sb.from("po_receipt_history").insert(batch);
    if (error) console.error(`   batch ${i} error: ${error.message}`);
    else rWritten += batch.length;
  }
  console.log(`   ${rWritten.toLocaleString()} written (${receiptRows.length - dedupedReceipts.length} dupes removed)\n`);

  await sb.from("sync_log").insert({
    action: "nsn_costs_rebuild",
    details: {
      nsn_costs_written: written,
      nsn_vendor_prices_written: vWritten,
      po_receipts_written: rWritten,
      source_distribution: sourceCounts,
    },
  });

  console.log("DONE.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
