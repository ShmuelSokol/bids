import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await sb.from("lamlinks_write_queue")
    .select("*")
    .order("created_at", { ascending: false }).limit(3);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
})();
