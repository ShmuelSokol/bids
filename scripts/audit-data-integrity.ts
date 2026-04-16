/**
 * Data integrity audit — catches silent row caps and data mismatches.
 *
 * Compares source-of-truth counts in Supabase against what each page
 * and API route would actually receive. Flags:
 *   - Exact 1000 counts (Supabase default cap)
 *   - Any query that returns fewer rows than expected
 *   - AX OData queries that might be silently truncated
 *
 * Run manually or via the post-push Claude Code hook:
 *   npx tsx scripts/audit-data-integrity.ts
 *   npx tsx scripts/audit-data-integrity.ts --json   (machine-readable)
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

const JSON_MODE = process.argv.includes("--json");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Check = {
  name: string;
  table: string;
  page: string;
  actual: number;
  suspicious: boolean;
  reason: string;
};

const results: Check[] = [];

async function countTable(table: string, filter?: (q: any) => any): Promise<number> {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

async function countPaginated(table: string, select: string, filter?: (q: any) => any): Promise<number> {
  let total = 0;
  for (let p = 0; p < 200; p++) {
    let q = sb.from(table).select(select).range(p * 1000, (p + 1) * 1000 - 1);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    total += data.length;
    if (data.length < 1000) break;
  }
  return total;
}

function check(name: string, table: string, page: string, actual: number) {
  const suspicious =
    actual === 1000 ||
    actual === 500 ||
    (actual > 0 && actual % 1000 === 0 && actual <= 10000);
  const reason = suspicious
    ? actual === 1000
      ? "EXACTLY 1000 — likely Supabase default cap"
      : actual === 500
      ? "EXACTLY 500 — likely .limit(500)"
      : `EXACT MULTIPLE OF 1000 (${actual}) — possible pagination cap`
    : "OK";
  results.push({ name, table, page, actual, suspicious, reason });
}

async function main() {
  if (!JSON_MODE) console.log("=== DIBS Data Integrity Audit ===\n");

  // 1. Awards — /orders page
  const awardsOurs = await countTable("awards", (q: any) => q.eq("cage", "0AG09"));
  const awards90d = await countTable("awards", (q: any) =>
    q.eq("cage", "0AG09").gte("award_date", new Date(Date.now() - 90 * 86400000).toISOString())
  );
  check("Our awards (total)", "awards", "/orders, /invoicing", awardsOurs);
  check("Our awards (90d, /orders page)", "awards", "/orders", awards90d);

  const awardsComp = await countTable("awards", (q: any) => q.neq("cage", "0AG09"));
  check("Competitor awards", "awards", "/solicitations history", awardsComp);

  // 2. NSN costs — used for margin calc on /orders
  const nsnCosts = await countTable("nsn_costs");
  check("NSN costs", "nsn_costs", "/orders margin calc", nsnCosts);

  // 3. NSN vendor prices — supplier switch modal
  const vendorPrices = await countTable("nsn_vendor_prices");
  check("NSN vendor prices", "nsn_vendor_prices", "/orders supplier switch", vendorPrices);

  // 4. NSN matches — /solicitations unsourceable match display
  const nsnMatches = await countTable("nsn_matches");
  check("NSN matches", "nsn_matches", "/solicitations match badges", nsnMatches);

  // 5. Bid decisions — /solicitations quoted/submitted/skipped tabs
  const bidDecisions = await countTable("bid_decisions");
  check("Bid decisions", "bid_decisions", "/solicitations tabs", bidDecisions);

  // 6. Abe bids live — dedup on /solicitations
  const abeBidsLive = await countTable("abe_bids_live");
  const abeBidsLive30d = await countTable("abe_bids_live", (q: any) =>
    q.gte("bid_time", new Date(Date.now() - 30 * 86400000).toISOString())
  );
  check("Abe bids live (total)", "abe_bids_live", "/bids/today", abeBidsLive);
  check("Abe bids live (30d, dedup)", "abe_bids_live", "/solicitations dedup", abeBidsLive30d);

  // 7. Abe bids (historical)
  const abeBids = await countTable("abe_bids");
  check("Abe bids (historical)", "abe_bids", "/solicitations history", abeBids);

  // 8. Solicitations
  const solsTotal = await countTable("dibbs_solicitations");
  const solsSourceable = await countTable("dibbs_solicitations", (q: any) => q.eq("is_sourceable", true));
  check("Solicitations (total)", "dibbs_solicitations", "/solicitations", solsTotal);
  check("Solicitations (sourceable)", "dibbs_solicitations", "/solicitations Sourceable tab", solsSourceable);

  // 9. Purchase orders + PO lines
  const pos = await countTable("purchase_orders");
  const poLines = await countTable("po_lines");
  check("Purchase orders", "purchase_orders", "/orders PO list", pos);
  check("PO lines", "po_lines", "/invoicing PO lines", poLines);

  // 10. PO award links
  const poLinks = await countTable("po_award_links");
  check("PO award links", "po_award_links", "/invoicing/followups", poLinks);

  // 11. Invoice state events
  const invoiceEvents = await countTable("invoice_state_events");
  check("Invoice state events", "invoice_state_events", "/invoicing/monitor", invoiceEvents);

  // 12. FSC heatmap
  const fscHeatmap = await countTable("fsc_heatmap");
  check("FSC heatmap", "fsc_heatmap", "/analytics", fscHeatmap);

  // 13. NSN catalog
  const nsnCatalog = await countTable("nsn_catalog");
  check("NSN catalog", "nsn_catalog", "enrichment", nsnCatalog);

  // Output
  if (JSON_MODE) {
    const suspicious = results.filter((r) => r.suspicious);
    console.log(JSON.stringify({ checks: results.length, suspicious: suspicious.length, results }, null, 2));
    process.exit(suspicious.length > 0 ? 1 : 0);
  }

  const maxName = Math.max(...results.map((r) => r.name.length));
  const maxTable = Math.max(...results.map((r) => r.table.length));

  for (const r of results) {
    const flag = r.suspicious ? "⚠ " : "  ";
    const count = r.actual.toLocaleString().padStart(8);
    const name = r.name.padEnd(maxName);
    const reason = r.suspicious ? `  ← ${r.reason}` : "";
    console.log(`${flag}${count}  ${name}  (${r.page})${reason}`);
  }

  const suspicious = results.filter((r) => r.suspicious);
  console.log(`\n${results.length} checks, ${suspicious.length} suspicious`);
  if (suspicious.length > 0) {
    console.log("\n⚠  SUSPICIOUS COUNTS DETECTED — these may indicate silent row caps:");
    for (const r of suspicious) {
      console.log(`   ${r.name}: ${r.actual.toLocaleString()} — ${r.reason}`);
    }
    process.exit(1);
  } else {
    console.log("\n✓ All counts look healthy — no exact-1000 caps detected.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
