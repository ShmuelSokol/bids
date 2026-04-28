import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data: a } = await sb.from("awards").select("*").limit(1);
  console.log("awards cols:", Object.keys(a?.[0] || {}));
  const { data: b } = await sb.from("abe_bids").select("*").limit(1);
  console.log("abe_bids cols:", Object.keys(b?.[0] || {}));
})();
