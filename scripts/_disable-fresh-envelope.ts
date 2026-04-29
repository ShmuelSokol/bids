import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { error } = await sb
    .from("system_settings")
    .upsert({
      key: "lamlinks_fresh_envelope_enabled",
      value: "false",
      description: "When true, the writeback worker mints a fresh k33 envelope if Abe has none staged. When false, queued rows wait until Abe saves a bid in LL first (piggyback only). Piggyback is cursor-clean (validated 2026-04-28); fresh-envelope produces cosmetic 9977720 cursor error on LL reopen since LL's k33 cursor is loaded before our INSERT. Default false until Sally REST put_client_quote is validated.",
    }, { onConflict: "key" });
  if (error) { console.error(error); process.exit(1); }
  const { data } = await sb.from("system_settings").select("key, value").eq("key", "lamlinks_fresh_envelope_enabled").maybeSingle();
  console.log("now:", data);
})();
