import "./env";
import { createServiceClient } from "../src/lib/supabase-server";
(async () => {
  const sb = createServiceClient();
  const { data: inv } = await sb.from("lamlinks_invoice_queue").select("id, state").in("state", ["processing", "approved"]);
  const { data: act } = await sb.from("lamlinks_rescue_actions").select("id, action, status").in("status", ["processing"]);
  console.log(`invoice in-flight: ${inv?.length || 0}`);
  console.log(`rescue in-flight:  ${act?.length || 0}`);
  if ((inv?.length || 0) === 0 && (act?.length || 0) === 0) console.log("✓ safe to bounce worker");
  else console.log("⚠ wait — work in flight");
})();
