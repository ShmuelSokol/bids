import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  await sb.from("system_settings").upsert({
    key: "lamlinks_invoice_writeback_enabled",
    value: "false",
    description: "Paused 2026-04-29 while diagnosing Abe's 9997768 cursor error on k07-1585 during LL invoice save.",
  }, { onConflict: "key" });
  const { data } = await sb.from("system_settings").select("key, value").in("key", ["lamlinks_invoice_writeback_enabled", "lamlinks_writeback_enabled", "lamlinks_fresh_envelope_enabled"]);
  console.log("flags now:");
  for (const f of data || []) console.log(`  ${f.key} = ${f.value}`);
})();
