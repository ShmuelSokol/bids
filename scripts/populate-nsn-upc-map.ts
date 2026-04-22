// Populate nsn_upc_map from the cached AX ProductBarcodesV3 dump.
//
// ProductBarcodesV3 carries entries for every barcode associated with an
// AX ItemNumber. An item can have multiple barcodes — one tagged "NSN"
// and (sometimes) one tagged "UPC". We already build nsn_catalog from
// the NSN rows; this script builds nsn_upc_map so the NPI generator can
// add a UPC BarCode row alongside the NSN row when we know it.
//
// Run whenever AX barcodes are refreshed (nightly catalog rebuild).

import "./env";
import { readFileSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const barcodesPath = path.join(__dirname, "..", "data", "d365", "barcodes.json");
  const barcodes: any[] = JSON.parse(readFileSync(barcodesPath, "utf-8"));
  console.log(`Loaded ${barcodes.length.toLocaleString()} barcode rows from AX dump`);

  // Extract UPC + NSN per item. One item can have multiple UPC rows; pick
  // the IsDefault one if present, else the first.
  type ItemBarcodes = { itemNumber: string; nsn?: string; upc?: string };
  const byItem = new Map<string, ItemBarcodes>();
  for (const b of barcodes) {
    const itemNumber = (b.ItemNumber || "").trim();
    if (!itemNumber) continue;
    if (!byItem.has(itemNumber)) byItem.set(itemNumber, { itemNumber });
    const entry = byItem.get(itemNumber)!;
    const setup = (b.BarcodeSetupId || "").trim().toUpperCase();
    const code = (b.Barcode || "").trim();
    if (!code) continue;
    if (setup === "NSN" && code.length === 13 && !entry.nsn) {
      // Format to 4-2-3-4 dashes to match our NSN format
      entry.nsn = `${code.slice(0, 4)}-${code.slice(4, 6)}-${code.slice(6, 9)}-${code.slice(9)}`;
    } else if (setup === "UPC") {
      const isDefault = b.IsDefaultScannedBarcode === "Yes" || b.IsDefaultScannedBarcode === true;
      if (isDefault || !entry.upc) entry.upc = code;
    }
  }

  // Produce rows for nsn_upc_map: only where both NSN and UPC known
  const rows = [];
  for (const e of byItem.values()) {
    if (e.nsn && e.upc) {
      rows.push({ nsn: e.nsn, upc: e.upc, ax_item_number: e.itemNumber });
    }
  }
  console.log(`Found ${rows.length.toLocaleString()} NSN↔UPC pairs (of ${byItem.size.toLocaleString()} unique items)`);

  if (rows.length === 0) { console.log("No pairs, done"); return; }

  // Make sure the table has the right shape
  const mgmtToken = "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91";
  await fetch("https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `ALTER TABLE nsn_upc_map ADD COLUMN IF NOT EXISTS nsn TEXT;
              ALTER TABLE nsn_upc_map ADD COLUMN IF NOT EXISTS upc TEXT;
              ALTER TABLE nsn_upc_map ADD COLUMN IF NOT EXISTS ax_item_number TEXT;
              ALTER TABLE nsn_upc_map ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
              CREATE INDEX IF NOT EXISTS nsn_upc_map_nsn ON nsn_upc_map(nsn);`,
    }),
  });

  // Clear + bulk insert
  console.log("Clearing + inserting...");
  await sb.from("nsn_upc_map").delete().neq("nsn", "___impossible___");
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await sb.from("nsn_upc_map").insert(chunk);
    if (error) { console.error(`batch ${i}: ${error.message}`); break; }
    if (i % 5000 === 0) console.log(`  ${i}/${rows.length}`);
  }
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
