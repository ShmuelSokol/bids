/**
 * Rebuild nsn_costs + nsn_vendor_prices from AX with proper waterfall
 * and unit-of-measure persistence.
 *
 * Waterfall (matches docs/pricing-logic.md):
 *   1. Recent PO  (RequestedDeliveryDate within 2 months)
 *   2. Recent PO  (within 3 months)
 *   3. AX price agreement (cheapest vendor)
 *   4. Older PO   (> 3 months)
 *
 * For each NSN:
 *   - nsn_costs gets ONE row: the waterfall-winner cost + source tag
 *     + vendor + unit_of_measure
 *   - nsn_vendor_prices gets ONE row per vendor known for that NSN
 *     (so Abe's Switch-Supplier UI still shows alternatives), each with
 *     its own UoM
 *
 * Why rebuild both: nsn_vendor_prices is 100% price_agreement today
 * (34K rows) and has no UoM. That's the root cause of the negative-
 * margin PO bug — vendor prices are in pack-units, award prices are
 * in each-units, and we multiply cost * qty as if they matched.
 *
 *   npx tsx scripts/populate-nsn-costs-from-ax.ts
 *   npx tsx scripts/populate-nsn-costs-from-ax.ts --dry-run
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

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

async function fetchAllPages(token: string, url: string): Promise<any[]> {
  const all: any[] = [];
  let nextUrl: string | null = url;
  while (nextUrl) {
    const resp = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      console.error(`  ERROR ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      break;
    }
    const data: any = await resp.json();
    all.push(...(data.value || []));
    nextUrl = data["@odata.nextLink"] || null;
    if (all.length % 5000 < 500) console.log(`    ...${all.length.toLocaleString()} fetched`);
  }
  return all;
}

/**
 * Map ItemNumber → NSN. Pulled from nsn_catalog (our AX→NSN mapping
 * built from ProductBarcodesV3). Paginated because 24K rows.
 */
async function loadItemToNsnMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 0; page < 30; page++) {
    const { data, error } = await sb
      .from("nsn_catalog")
      .select("item_number, nsn")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) if (r.item_number && r.nsn) map.set(r.item_number, r.nsn);
    if (data.length < 1000) break;
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

  console.log("1. Loading item_number → NSN map from nsn_catalog...");
  const itemToNsn = await loadItemToNsnMap();
  console.log(`   ${itemToNsn.size.toLocaleString()} ItemNumber → NSN mappings\n`);

  console.log("2. Authenticating to AX...");
  const token = await getToken();

  console.log("3. Pulling PurchaseOrderLinesV2 (transacted costs)...");
  const poLines = await fetchAllPages(
    token,
    `${D365_URL}/data/PurchaseOrderLinesV2?cross-company=true&$select=ItemNumber,PurchasePrice,PurchaseUnitSymbol,RequestedDeliveryDate,VendorAccountNumber`
  );
  console.log(`   ${poLines.length.toLocaleString()} PO lines\n`);

  console.log("4. Pulling PurchasePriceAgreements (asking prices)...");
  const priceAgreements = await fetchAllPages(
    token,
    `${D365_URL}/data/PurchasePriceAgreements?cross-company=true&$select=ItemNumber,Price,QuantityUnitSymbol,VendorAccountNumber`
  );
  console.log(`   ${priceAgreements.length.toLocaleString()} price agreements\n`);

  // Build candidate buckets per NSN, with vendor + UoM attached.
  console.log("5. Bucketing by NSN...");
  const byNsn = new Map<string, CostCandidate[]>();

  for (const p of poLines) {
    const nsn = itemToNsn.get(p.ItemNumber);
    if (!nsn || !p.PurchasePrice || p.PurchasePrice <= 0) continue;
    const source = bucketForPO(p.RequestedDeliveryDate);
    const cand: CostCandidate = {
      cost: p.PurchasePrice,
      source,
      vendor: p.VendorAccountNumber || null,
      uom: p.PurchaseUnitSymbol?.trim() || null,
      itemNumber: p.ItemNumber,
    };
    if (!byNsn.has(nsn)) byNsn.set(nsn, []);
    byNsn.get(nsn)!.push(cand);
  }

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
  console.log("6. Applying waterfall → nsn_costs...");
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
  console.log("7. Rolling up vendor alternatives → nsn_vendor_prices...");
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
  console.log("8. Source distribution in new nsn_costs:");
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
  console.log("\n9. Clearing existing rows...");
  await sb.from("nsn_costs").delete().not("nsn", "is", null);
  await sb.from("nsn_vendor_prices").delete().not("nsn", "is", null);

  console.log("10. Writing nsn_costs...");
  let written = 0;
  for (let i = 0; i < nsnCostsRows.length; i += 500) {
    const batch = nsnCostsRows.slice(i, i + 500);
    const { error } = await sb.from("nsn_costs").insert(batch);
    if (error) console.error(`   batch ${i} error: ${error.message}`);
    else written += batch.length;
  }
  console.log(`   ${written.toLocaleString()} written\n`);

  console.log("11. Writing nsn_vendor_prices...");
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
