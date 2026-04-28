import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from("lamlinks_rest_queue").select("*").order("id", { ascending: false }).limit(3);
  for (const r of data || []) {
    console.log(`--- row ${r.id} ---`);
    console.log(`fn: ${r.lis_function}, state: ${r.state}, http: ${r.http_status}, compCode: ${r.completion_code}, host: ${r.worker_host}`);
    console.log(`response_xml:`);
    console.log(r.response_xml || "(empty)");
    console.log("");
  }
})();
