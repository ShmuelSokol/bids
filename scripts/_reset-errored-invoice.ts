import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const id = Number(process.argv[2]);
  if (!id) { console.error("Usage: <queue-row-id>"); process.exit(1); }
  const { data, error } = await sb.from("lamlinks_invoice_queue").update({
    state: "pending", picked_up_at: null, error_message: null, worker_host: null,
  }).eq("id", id).select("ax_invoice_number");
  if (error) { console.error(error); process.exit(1); }
  console.log("reset:", data);
})();
