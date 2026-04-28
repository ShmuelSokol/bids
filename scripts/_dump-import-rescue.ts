import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from("lamlinks_rescue_actions").select("*").eq("id", 1).single();
  console.log(JSON.stringify(data, null, 2));
})();
