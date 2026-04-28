import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { count, data } = await sb.from("lamlinks_invoice_queue").select("*", { count: "exact" }).limit(3);
  console.log("rows:", count); console.log("sample:", data);
})();
