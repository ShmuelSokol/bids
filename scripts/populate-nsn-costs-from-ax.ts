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
import { fetchAxPaginated } from "./ax-fetch";

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
  const { rows } = await fetchAxPaginated(token, url, { label });
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

  console.log("3. Pulling PurchasePriceAgreements (asking prices + UoM)...");
  const priceAgreements = await fetchAllPages(
    token,
    `${D365_URL}/data/PurchasePriceAgreements?cross-company=true&$select=ItemNumber,Price,QuantityUnitSymbol,VendorAccountNumber`
  );
  console.log(`   ${priceAgreements.length.toLocaleString()} price agreements\n`);

  // Build candidate buckets per NSN, with vendor + UoM attached.
  console.log("4. Bucketing by NSN...");
  const byNsn = new Map<string, CostCandidate[]>();

  for (const p of priceAgreements) {
    const nsn = itemToNsn.get(p.ItemNumber);
    if (!nsn || !p.Price || p.Price <= 0) continue;
    const cand: CostCandidate = {
      cost: p.Price,
      source: "AX price agreement (cheapest vendor)",
      vendor: p.VendorAccountNumber || null,
      uom: p.QuantityUnitSymbol?.trim() || null,
      itemNumber: p.ItemNumber,
    };
    if (!byNsn.has(nsn)) byNsn.set(nsn, []);
    byNsn.get(nsn)!.push(cand);
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
    nsnCostsRows.push({
      nsn,
      cost: winner.cost,
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
    return {
      nsn,
      vendor: c.vendor!,
      price: c.cost,
      price_source: c.source,
      unit_of_measure: c.uom,
      item_number: c.itemNumber,
      updated_at: new Date().toISOString(),
    };
  });
  console.log(`   ${vendorPriceRows.length.toLocaleString()} nsn_vendor_prices rows built\n`);

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

  await sb.from("sync_log").insert({
    action: "nsn_costs_rebuild",
    details: {
      nsn_costs_written: written,
      nsn_vendor_prices_written: vWritten,
      source_distribution: sourceCounts,
    },
  });

  console.log("DONE.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
