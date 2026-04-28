import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  // Reset the failed rescue row so the freshly-restarted daemon picks it up
  const { error } = await sb.from("lamlinks_rescue_actions").update({
    status: "pending", picked_up_at: null, processed_at: null, error: null, result: null,
  }).eq("id", 1);
  if (error) console.error(error);
  else console.log("✓ rescue id=1 reset to pending — daemon will retry within 30s");
})();
