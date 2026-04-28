import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await sb.from("lamlinks_rescue_actions").insert({
    action: "curl_test",
    params: {
      url: "http://api.lamlinks.com/api/rfq/get_sent_quotes_by_timeframe",
      sally_login: process.env.LL_SALLY_LOGIN,
      api_key: process.env.LL_API_KEY,
      api_secret: process.env.LL_API_SECRET,
    },
    requested_by: "ip-whitelist-test",
    status: "pending",
  }).select("id").single();
  if (error) { console.error(error); process.exit(1); }
  console.log("queued rescue action id:", data.id);
  // poll
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const { data: row } = await sb.from("lamlinks_rescue_actions").select("status, result, error").eq("id", data.id).maybeSingle();
    if (row?.status === "done" || row?.status === "error") {
      console.log("\nstatus:", row.status);
      console.log("result:", JSON.stringify(row.result, null, 2).slice(0, 1500));
      if (row.error) console.log("error:", row.error);
      return;
    }
  }
  console.log("timed out waiting");
})();
