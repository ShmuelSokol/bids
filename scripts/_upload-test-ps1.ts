// Upload sally-test.ps1 to Supabase Storage so NYEVRVSQL001 can download
// + run it via Invoke-WebRequest. Avoids RDP em-dash autocorrect entirely
// (no paste, no Notepad — bytes are constructed in code from ASCII).
import "./env";
import { createClient } from "@supabase/supabase-js";

const DD = "\x2D\x2D"; // two ASCII hyphens — guaranteed not em-dash

const ps1 = [
  '# DIBS Sally REST whitelist test - generated server-side, no human paste involved.',
  '',
  '$body  = "wait=15&function=are_you_listening&data=%3CRequest%3E%3Clis_function%3Eare_you_listening%3C%2Flis_function%3E%3Ce_code%3E0AG09%3C%2Fe_code%3E%3Creq_data%3E%3C%2Freq_data%3E%3C%2FRequest%3E"',
  '$creds = "ajoseph@everreadygroup.com#7Lx6La4QIpESAgNhfJmSPhWn0Yk:6i^,j5F29jQxCF"',
  '$url   = "http://api.lamlinks.com/api/llsm/create"',
  '$jar   = "$env:TEMP\\ll-jar.txt"',
  '$out   = "$env:TEMP\\sally-response.xml"',
  '',
  `& "G:\\PROGRAMS\\LAMLINKS\\Control\\Lamlinkp\\LLPservr\\code\\curl.exe" ${DD}digest ${DD}data $body -u $creds -c $jar $url -o $out`,
  '',
  'Write-Host ""',
  'Write-Host "=== Response ($out) ===" -ForegroundColor Cyan',
  'Get-Content $out',
  'Write-Host ""',
  'Write-Host "=== End of response ===" -ForegroundColor Cyan',
].join("\r\n");

import { createClient } from "@supabase/supabase-js";

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await sb.storage.createBucket("briefings", { public: true }).catch(() => {});
  const { error } = await sb.storage.from("briefings").upload("sally-test.ps1", Buffer.from(ps1, "utf-8"), {
    contentType: "text/plain",
    upsert: true,
  });
  if (error) { console.error("upload failed:", error.message); process.exit(1); }
  const { data } = sb.storage.from("briefings").getPublicUrl("sally-test.ps1");
  console.log("✓ uploaded to:", data.publicUrl);
})();
