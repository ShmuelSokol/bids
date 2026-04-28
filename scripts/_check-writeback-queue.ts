import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb
    .from("lamlinks_write_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);
  for (const r of data || []) {
    console.log(`id=${r.id} status=${r.status} sol=${r.sol_no} qty=${r.bid_qty} price=${r.bid_price}`);
    console.log(`  created=${r.created_at} processed=${r.processed_at || "—"}`);
    if (r.error_message) console.log(`  error: ${r.error_message}`);
    if (r.result) console.log(`  result: ${JSON.stringify(r.result).slice(0,200)}`);
    console.log("");
  }
})();
