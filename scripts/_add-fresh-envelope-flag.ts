import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { error } = await sb.from("system_settings").upsert({
    key: "lamlinks_fresh_envelope_enabled",
    value: "true",
    description: "When true, the writeback worker mints a fresh k33 envelope if Abe has none staged. When false, queued rows wait until Abe saves a bid in LL first (piggyback only). Fresh envelopes work but trigger cosmetic VFP cursor error 9977720 in LL UI. Flip false to suppress that error at the cost of requiring Abe to seed each batch.",
    updated_at: new Date().toISOString(),
    updated_by: "ssokol@everreadygroup.com",
  }, { onConflict: "key" });
  if (error) throw error;
  console.log("✓ flag added");
})();
