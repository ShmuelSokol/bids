import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb.from("lamlinks_invoice_queue").select("*").eq("ax_invoice_number", "CIN0066186").maybeSingle();
  console.log(JSON.stringify(data, null, 2));
})();
