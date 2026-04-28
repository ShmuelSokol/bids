import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  // Fire a known-authorized function: get_sent_quotes_by_timeframe with today's window.
  // Body shape matches what LL's own logs show.
  const minDate = "4%2F28%2F2026+12%3A00%3A00+AM+UTC";
  const maxDate = "4%2F28%2F2026+11%3A59%3A59+PM+UTC";
  const body = `quote_min_datetime=${minDate}&quote_max_datetime=${maxDate}`;
  const { data, error } = await sb.from("lamlinks_rest_queue").insert({
    lis_function: "get_sent_quotes_by_timeframe",
    e_code: "0AG09",
    req_data_xml: body,
    wait_seconds: 15,
    enqueued_by: "shmuel-rfq-test",
    related_kind: "test_authorized_function",
  }).select("*").single();
  if (error) { console.error(error); process.exit(1); }
  console.log("✓ enqueued row id:", data.id);
})();
