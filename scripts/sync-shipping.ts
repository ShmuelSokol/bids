/**
 * Sync shipment data from LamLinks → Supabase for the shipping page.
 * Run locally: npx tsx scripts/sync-shipping.ts
 */
import "dotenv/config";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== Shipping Sync: LamLinks → Supabase ===\n");

  const pool = await sql.connect(config);

  const query = readFileSync(join(__dirname, "tmp-shipping-v2.sql"), "utf-8")
    .replace("TOP 50", "TOP 500"); // Get more data

  const result = await pool.request().query(query);
  console.log(`Found ${result.recordset.length} shipments from LamLinks\n`);

  await pool.close();

  // Transform and save to Supabase
  const shipments = result.recordset.map((r: any) => ({
    ship_number: r.ship_number?.trim() || "",
    ship_status: r.ship_status?.trim() || "",
    ship_date: r.ship_date,
    transport_mode: r.transport_mode?.trim() || "",
    tracking_number: r.tracking?.trim() || null,
    weight_lbs: r.weight || 0,
    box_count: r.boxes || 1,
    edi_id: r.edi_id?.trim() || null,
    quantity: r.qty || 0,
    sell_value: r.value || 0,
    job_status: r.job_status?.trim() || "",
    clin: r.clin?.trim() || "",
    fob: r.fob?.trim() || "",
    required_delivery: r.required_delivery,
    contract_number: r.contract?.trim() || "",
    nsn: r.fsc && r.niin ? `${r.fsc.trim()}-${r.niin.trim()}` : null,
    description: r.description?.trim() || "",
    data_source: "lamlinks",
  }));

  // Upsert to shipments table
  let saved = 0;
  for (let i = 0; i < shipments.length; i += 100) {
    const batch = shipments.slice(i, i + 100);
    const { error } = await sb
      .from("ll_shipments")
      .upsert(batch, { onConflict: "ship_number,contract_number,clin" });
    if (error) {
      console.error(`Batch error: ${error.message}`);
    } else {
      saved += batch.length;
    }
  }

  console.log(`Saved ${saved} shipments to Supabase ll_shipments`);

  await sb.from("sync_log").insert({
    action: "shipping_sync",
    details: { total: shipments.length, saved },
  });
}

main().catch(console.error);
