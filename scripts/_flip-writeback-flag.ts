import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await sb
    .from("system_settings")
    .update({
      value: "true",
      description:
        "Re-enabled 2026-04-27 to validate the k07 cursor-fix patch in the worker (12+ k07 SOL_FORM_PREFERENCES UPDATEs per Post burst — confirmed via 2026-04-27 XE trace). Sally REST creds confirmed working from NYEVRVTC001 only; REST writeback worker design at docs/architecture/sally-rest-worker.md. SQL writeback remains the active path until REST is proven end-to-end.",
      updated_at: new Date().toISOString(),
      updated_by: "ssokol@everreadygroup.com",
    })
    .eq("key", "lamlinks_writeback_enabled")
    .select("*")
    .single();
  if (error) { console.error(error); process.exit(1); }
  console.log("✅ Flipped:", { key: data.key, value: data.value, updated_at: data.updated_at });
})();
