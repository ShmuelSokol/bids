import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data } = await sb
    .from("sync_log")
    .select("*")
    .eq("action", "po_generated")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log(`Most recent 5 po_generated sync_log rows:\n`);
  for (const r of data || []) {
    console.log(`at ${r.created_at}:`);
    console.log(`  ${JSON.stringify(r.details, null, 2)}`);
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
