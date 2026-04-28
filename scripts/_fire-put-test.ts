import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await sb.from("lamlinks_rest_queue").insert({
    lis_function: "put_client_quote",
    e_code: "0AG09",
    req_data_xml: "",
    wait_seconds: 15,
    enqueued_by: "shmuel-acl-probe",
    related_kind: "acl_probe",
  }).select("*").single();
  if (error) { console.error(error); process.exit(1); }
  console.log("✓ enqueued put_client_quote probe, row id:", data.id);
})();
