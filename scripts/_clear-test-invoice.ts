import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { error, count } = await sb.from("lamlinks_invoice_queue").delete({ count: "exact" }).eq("ax_invoice_number", "CIN0066169");
  if (error) console.error(error);
  console.log(`cleared ${count} row(s) for CIN0066169 (Abe did it manually)`);
})();
