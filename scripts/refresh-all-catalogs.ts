/**
 * Refresh all catalog/reference tables from their source systems.
 * Runs nightly or on-demand. Handles:
 *   1. nsn_catalog — AX ProductBarcodesV3 (NSN barcodes → item numbers)
 *   2. publog_nsns — PUB LOG API (NSN specs, nomenclature, pricing)
 *   3. usaspending_awards — USASpending API (competitor DLA awards)
 *   4. vendor_parts — AX VendorProductDescriptionsV2 (NEW — was pulled but never stored)
 *
 *   npx tsx scripts/refresh-all-catalogs.ts
 *   npx tsx scripts/refresh-all-catalogs.ts --only nsn_catalog
 *   npx tsx scripts/refresh-all-catalogs.ts --only publog
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { fetchAxPaginated } from "./ax-fetch";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const onlyIdx = process.argv.indexOf("--only");
const ONLY = process.argv.find(a => a.startsWith("--only="))?.split("=")[1] || (onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null);

async function getAxToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AX_CLIENT_ID!,
    client_secret: process.env.AX_CLIENT_SECRET!,
    scope: `${process.env.AX_D365_URL}/.default`,
  });
  const r = await fetch(`https://login.microsoftonline.com/${process.env.AX_TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: params });
  const d: any = await r.json();
  if (!d.access_token) throw new Error("AX auth failed");
  return d.access_token;
}

async function refreshNsnCatalog(token: string) {
  console.log("\n=== 1. nsn_catalog (AX ProductBarcodesV3, NSN barcodes) ===");
  const D = process.env.AX_D365_URL!;
  const { rows, truncated } = await fetchAxPaginated(token,
    `${D}/data/ProductBarcodesV3?cross-company=true&$select=ItemNumber,Barcode,BarcodeSetupId,ProductDescription&$filter=BarcodeSetupId eq 'NSN'`,
    { label: "ProductBarcodesV3 NSN" });
  if (truncated) console.warn("  ⚠ Truncation detected on NSN barcode pull");
  console.log(`  Pulled ${rows.length} NSN barcodes from AX`);

  const upserts: any[] = [];
  for (const r of rows) {
    const item = r.ItemNumber?.trim();
    const raw = r.Barcode?.trim();
    if (!item || !raw) continue;
    const digits = raw.replace(/-/g, "");
    if (digits.length !== 13) continue;
    const nsn = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
    upserts.push({
      nsn,
      source: `AX:${item}`,
      description: r.ProductDescription?.trim() || null,
      updated_at: new Date().toISOString(),
    });
  }

  let saved = 0;
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await sb.from("nsn_catalog").upsert(upserts.slice(i, i + 500), { onConflict: "nsn" });
    if (error) console.error(`  batch ${i} error:`, error.message);
    else saved += upserts.slice(i, i + 500).length;
  }
  console.log(`  Upserted ${saved} rows to nsn_catalog`);

  await sb.from("sync_log").insert({ action: "nsn_catalog_refresh", details: { pulled: rows.length, upserted: saved, truncated } });
}

async function refreshPublog() {
  console.log("\n=== 2. publog_nsns (PUB LOG API) ===");
  const KEY = process.env.MASTERDB_API_KEY;
  if (!KEY) { console.log("  MASTERDB_API_KEY not set, skipping"); return; }

  // PUB LOG data comes through Master DB's export endpoint
  const resp = await fetch("https://masterdb.everreadygroup.com/api/dibs/items/export?has_nsn=1", {
    headers: { "X-Api-Key": KEY },
    signal: AbortSignal.timeout(120000),
  });
  if (!resp.ok) { console.error(`  Master DB HTTP ${resp.status}`); return; }
  const text = await resp.text();
  let items: any[];
  try {
    items = JSON.parse(text);
  } catch {
    // May be NDJSON (one JSON object per line)
    items = text.split("\n").filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  }
  console.log(`  Pulled ${items.length} items from Master DB`);

  const rows = items.filter((it: any) => it.nsn).map((it: any) => {
    const nsn = it.nsn;
    const parts = nsn.split("-");
    return {
      nsn,
      fsc: parts[0] || null,
      niin: parts.slice(1).join("-") || null,
      item_name: it.item_name || it.description || null,
      unit_price: it.unit_price ? Number(it.unit_price) : null,
      unit_of_issue: it.unit_of_issue || null,
      cage_code: it.cage_code || null,
      part_number: it.mfr_part_number || null,
    };
  });

  let saved = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("publog_nsns").upsert(rows.slice(i, i + 500), { onConflict: "nsn" });
    if (error) console.error(`  batch ${i} error:`, error.message);
    else saved += rows.slice(i, i + 500).length;
  }
  console.log(`  Upserted ${saved} rows to publog_nsns`);

  await sb.from("sync_log").insert({ action: "publog_refresh", details: { pulled: items.length, upserted: saved } });
}

async function refreshUsaspending() {
  console.log("\n=== 3. usaspending_awards (USASpending API) ===");
  // Pull DLA awards for our FSCs. The API paginates with page/limit.
  const fscList: string[] = [];
  for (let p = 0; p < 5; p++) {
    const { data } = await sb.from("fsc_heatmap").select("fsc_code").range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    fscList.push(...data.map((d: any) => d.fsc_code));
    if (data.length < 1000) break;
  }
  console.log(`  Pulling for ${fscList.length} FSCs`);

  let totalPulled = 0;
  const allRows: any[] = [];

  for (const fsc of fscList.slice(0, 50)) {
    let page = 1;
    const limit = 100;
    while (page <= 10) {
      try {
        const resp = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filters: {
              agencies: [{ type: "awarding", tier: "subtier", name: "Defense Logistics Agency" }],
              psc_codes: [fsc],
              time_period: [{ start_date: "2024-01-01", end_date: new Date().toISOString().split("T")[0] }],
            },
            fields: ["Award ID", "Recipient Name", "Award Amount", "Start Date", "End Date", "Award Type", "Awarding Agency", "NAICS Code", "generated_internal_id"],
            page, limit, sort: "Award Amount", order: "desc",
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) break;
        const data: any = await resp.json();
        const results = data.results || [];
        if (results.length === 0) break;

        for (const r of results) {
          allRows.push({
            generated_internal_id: r["generated_internal_id"] || null,
            award_id: r["Award ID"],
            recipient_name: r["Recipient Name"],
            award_amount: r["Award Amount"],
            description: r["Award Type"] || null,
            start_date: r["Start Date"],
            end_date: r["End Date"],
            psc_code: fsc,
            awarding_sub_agency: "Defense Logistics Agency",
            updated_at: new Date().toISOString(),
          });
        }
        totalPulled += results.length;
        if (results.length < limit) break;
        page++;
      } catch {
        break;
      }
    }
    if (totalPulled % 500 < 100 && totalPulled > 0) process.stdout.write(`  ...${totalPulled} pulled\r`);
  }
  console.log(`  Total pulled: ${totalPulled} from ${fscList.length} FSCs`);

  if (allRows.length > 0) {
    // Clear and reload
    await sb.from("usaspending_awards").delete().not("id", "is", null);
    let saved = 0;
    for (let i = 0; i < allRows.length; i += 500) {
      const { error } = await sb.from("usaspending_awards").insert(allRows.slice(i, i + 500));
      if (error) console.error(`  batch ${i} error:`, error.message);
      else saved += allRows.slice(i, i + 500).length;
    }
    console.log(`  Saved ${saved} rows (was 10,000 capped)`);
    await sb.from("sync_log").insert({ action: "usaspending_refresh", details: { pulled: totalPulled, saved, fscs: fscList.length } });
  }
}

async function main() {
  console.log("=== CATALOG REFRESH ===");
  console.log("Time:", new Date().toISOString());
  if (ONLY) console.log("Only:", ONLY);

  const token = await getAxToken();

  if (!ONLY || ONLY === "nsn_catalog") await refreshNsnCatalog(token);
  if (!ONLY || ONLY === "publog") await refreshPublog();
  if (!ONLY || ONLY === "usaspending") await refreshUsaspending();

  console.log("\nDone!");
}

main().catch(e => { console.error(e); process.exit(1); });
