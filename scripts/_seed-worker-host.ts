import "./env";
import { createClient } from "@supabase/supabase-js";
import { hostname } from "os";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const host = hostname();
  await sb.from("system_settings").upsert(
    { key: "lamlinks_worker_host", value: host, description: "Hostname of the box currently running the LamLinks recurring daemon. Updated on every heartbeat." },
    { onConflict: "key" },
  );
  console.log("✓ seeded lamlinks_worker_host =", host);
})();
