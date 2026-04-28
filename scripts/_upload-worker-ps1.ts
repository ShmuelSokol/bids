import "./env";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await sb.storage.createBucket("briefings", { public: true }).catch(() => {});
  const content = readFileSync("scripts/ll-rest-worker.ps1");
  const { error } = await sb.storage.from("briefings").upload("ll-rest-worker.ps1", content, {
    contentType: "text/plain",
    upsert: true,
  });
  if (error) { console.error("upload failed:", error.message); process.exit(1); }
  const { data } = sb.storage.from("briefings").getPublicUrl("ll-rest-worker.ps1");
  console.log("URL:", data.publicUrl);
})();
