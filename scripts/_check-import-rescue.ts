import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from("lamlinks_rescue_actions").select("*").eq("action", "import_dd219_invoices").order("id", { ascending: false }).limit(3);
  for (const r of data || []) {
    console.log(`id=${r.id} status=${r.status} created=${r.created_at} completed=${r.completed_at}`);
    console.log(`  params=${JSON.stringify(r.params)}`);
    if (r.error_message) console.log(`  err=${r.error_message}`);
    if (r.result) console.log(`  result=${JSON.stringify(r.result).slice(0, 300)}`);
  }
})();
