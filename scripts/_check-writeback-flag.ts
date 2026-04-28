import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await sb.from("system_settings").select("*").like("key", "%writeback%");
  if (error) { console.error(error); process.exit(1); }
  console.table(data);
})();
