import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1. Schema of purchase_orders
  const mgmtToken = "sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91";
  const schemaResp = await fetch("https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'purchase_orders' ORDER BY ordinal_position`,
    }),
  });
  console.log("purchase_orders schema:");
  const schema = JSON.parse(await schemaResp.text());
  for (const c of schema) {
    console.log(`  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} null=${c.is_nullable} default=${c.column_default || ""}`);
  }

  // 2. Attempt a raw insert mimicking what generate-pos does
  console.log("\nAttempting a test insert with service role key...");
  const { data, error } = await sb
    .from("purchase_orders")
    .insert({
      po_number: `TEST-DEBUG-${Date.now()}`,
      supplier: "TEST_SUPPLIER",
      status: "draft",
      total_cost: 100,
      line_count: 1,
      created_by: "debug-script",
    })
    .select()
    .single();
  if (error) {
    console.log(`  FAILED: ${error.message}`);
    console.log(`  details: ${JSON.stringify(error)}`);
  } else {
    console.log(`  OK: inserted po id=${data.id} po_number=${data.po_number}`);
    // Clean up
    await sb.from("purchase_orders").delete().eq("id", data.id);
    console.log(`  (cleaned up test row)`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
