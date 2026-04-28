/**
 * Smoke test: enqueue an `are_you_listening` row and read it back.
 * Confirms schema + service-role insert work. Worker not required for this test.
 *   npx tsx scripts/_smoke-rest-queue.ts
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: inserted, error: insErr } = await sb
    .from("lamlinks_rest_queue")
    .insert({
      lis_function: "are_you_listening",
      e_code: "0AG09",
      req_data_xml: "",
      wait_seconds: 15,
      enqueued_by: "smoke-test",
      related_kind: "heartbeat",
    })
    .select("*")
    .single();
  if (insErr) { console.error("INSERT failed:", insErr.message); process.exit(1); }
  console.log("✅ INSERT ok, row id:", inserted.id, "state:", inserted.state);

  const { data: read } = await sb.from("lamlinks_rest_queue").select("*").eq("id", inserted.id).single();
  console.log("✅ READ ok:", { id: read.id, state: read.state, lis_function: read.lis_function });

  const { error: delErr } = await sb.from("lamlinks_rest_queue").delete().eq("id", inserted.id);
  if (delErr) console.error("⚠ DELETE failed (cleanup):", delErr.message);
  else console.log("✅ DELETE ok (cleaned up smoke row)");
})();
