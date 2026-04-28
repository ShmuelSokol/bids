import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data: files } = await sb.storage.from("briefings").list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } });
  const tests = (files || []).filter(f => f.name.startsWith("ll-api-test-result-"));
  console.log("Recent test result files:");
  for (const f of tests.slice(0, 10)) {
    console.log("  " + f.name + "   created=" + f.created_at);
  }
  // Download the latest
  if (tests.length > 0) {
    const latest = tests[0];
    console.log("\n=== Latest: " + latest.name + " ===");
    const { data: blob } = await sb.storage.from("briefings").download(latest.name);
    if (blob) console.log(await blob.text());
  }
})();
