import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  // Clean up row 5
  await sb.from("lamlinks_rest_queue").update({
    state: "error",
    completed_at: new Date().toISOString(),
    error_message: "abandoned — empty body issue, replaced by row with e_code body",
  }).eq("id", 5);
  console.log("row 5 marked error");

  // Fire row 6 with minimal body — just e_code, no bid data
  const { data, error } = await sb.from("lamlinks_rest_queue").insert({
    lis_function: "put_client_quote",
    e_code: "0AG09",
    req_data_xml: "e_code=0AG09",
    wait_seconds: 15,
    enqueued_by: "shmuel-acl-probe-v2",
    related_kind: "acl_probe",
  }).select("*").single();
  if (error) { console.error(error); process.exit(1); }
  console.log("✓ enqueued row id:", data.id);
})();
