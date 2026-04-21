// Pull VendorProductDescriptionsV2 from AX, join each row's ItemNumber to our
// nsn_catalog (which holds NSN → "AX:ItemNumber" strings) so we end up with
// NSN → (vendor account, vendor product number, vendor description).
// Writes to Supabase table nsn_ax_vendor_parts for UI display.
//
// This is NOT a source of DLA-approved mfr CAGE (AX tracks vendors, not mfrs).
// But it answers "which vendors do we stock this NSN from?" which helps Abe
// verify suspicious fuzzy-match part numbers. See docs/lamlinks-writeback.md
// caveat section.

import "./env";
import { createClient } from "@supabase/supabase-js";

async function getToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AX_CLIENT_ID!,
    client_secret: process.env.AX_CLIENT_SECRET!,
    scope: `${process.env.AX_D365_URL!}/.default`,
  });
  const resp = await fetch(`https://login.microsoftonline.com/${process.env.AX_TENANT_ID!}/oauth2/v2.0/token`, {
    method: "POST", body: params,
  });
  const d = await resp.json();
  if (!d.access_token) throw new Error("auth failed: " + d.error_description);
  return d.access_token;
}

async function fetchAll(token: string, url: string): Promise<any[]> {
  const all: any[] = [];
  let next: string | null = url;
  while (next) {
    const r = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { console.error(`  fetch ${r.status}: ${await r.text()}`); break; }
    const data = await r.json();
    all.push(...(data.value || []));
    next = data["@odata.nextLink"] || null;
    if (all.length > 0 && all.length % 10000 < 1000) console.log(`  ${all.length.toLocaleString()}...`);
  }
  return all;
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const mgmtToken = "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91";

  // Create the table
  console.log("Ensuring nsn_ax_vendor_parts table exists...");
  const createResp = await fetch("https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        CREATE TABLE IF NOT EXISTS nsn_ax_vendor_parts (
          nsn TEXT NOT NULL,
          ax_item_number TEXT NOT NULL,
          vendor_account TEXT,
          vendor_product_number TEXT,
          vendor_description TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (nsn, ax_item_number, vendor_account, vendor_product_number)
        );
        CREATE INDEX IF NOT EXISTS idx_nsn_ax_vendor_parts_nsn ON nsn_ax_vendor_parts(nsn);
      `,
    }),
  });
  console.log(`  ${createResp.status} ${await createResp.text()}`);

  // Load nsn_catalog to build ItemNumber → NSN map
  console.log("\nLoading nsn_catalog (NSN ↔ AX ItemNumber)...");
  const catalogRows: { nsn: string; source: string }[] = [];
  for (let p = 0; p < 100; p++) {
    const { data, error } = await supabase.from("nsn_catalog").select("nsn, source").range(p * 1000, (p + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    catalogRows.push(...data);
    if (data.length < 1000) break;
  }
  const itemToNsn = new Map<string, string>();
  for (const r of catalogRows) {
    const m = /^AX:(.+)$/.exec(r.source || "");
    if (m) itemToNsn.set(m[1].trim(), r.nsn);
  }
  console.log(`  ${catalogRows.length.toLocaleString()} catalog rows, ${itemToNsn.size.toLocaleString()} AX-sourced`);

  // Pull AX
  console.log("\nAuthenticating to AX...");
  const token = await getToken();
  console.log("Pulling VendorProductDescriptionsV2...");
  const vendorParts = await fetchAll(
    token,
    `${process.env.AX_D365_URL}/data/VendorProductDescriptionsV2?cross-company=true&$select=ItemNumber,VendorAccountNumber,VendorProductNumber,VendorProductDescription`
  );
  console.log(`  ${vendorParts.length.toLocaleString()} vendor-item rows total`);

  // Build rows for Supabase: only those whose ItemNumber has an NSN in our catalog
  const rows: any[] = [];
  for (const vp of vendorParts) {
    const nsn = itemToNsn.get(vp.ItemNumber);
    if (!nsn) continue;
    const vendorPn = (vp.VendorProductNumber || "").trim();
    if (!vendorPn) continue;
    rows.push({
      nsn,
      ax_item_number: vp.ItemNumber,
      vendor_account: (vp.VendorAccountNumber || "").trim() || null,
      vendor_product_number: vendorPn,
      vendor_description: (vp.VendorProductDescription || "").slice(0, 200) || null,
      updated_at: new Date().toISOString(),
    });
  }
  console.log(`  ${rows.length.toLocaleString()} matched to our NSN catalog`);

  // Clear + bulk insert (small enough to fit)
  console.log("\nUpserting to nsn_ax_vendor_parts...");
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("nsn_ax_vendor_parts").upsert(chunk, {
      onConflict: "nsn,ax_item_number,vendor_account,vendor_product_number",
    });
    if (error) { console.error(`  batch ${i}: ${error.message}`); break; }
    if (i % 5000 === 0) console.log(`  ${i}/${rows.length} upserted`);
  }
  console.log("  Done.");

  // Verify on our test NSN
  const { data: sample } = await supabase
    .from("nsn_ax_vendor_parts")
    .select("*")
    .eq("nsn", "6509-01-578-7887");
  console.log(`\nRows for NSN 6509-01-578-7887 (the one Abe flagged):`);
  for (const r of sample || []) console.log(" ", JSON.stringify(r));
}
main().catch((e) => { console.error(e); process.exit(1); });
