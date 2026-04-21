/**
 * Sync health check — alerts if LamLinks syncs stopped running.
 * Add to Windows Task Scheduler to run hourly during business hours.
 *
 *   npx tsx scripts/check-sync-health.ts
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();

  // Check if abe_bids_live_sync has run in the last 2 hours
  const { data: recent } = await sb.from("sync_log")
    .select("action, created_at")
    .eq("action", "abe_bids_live_sync")
    .gte("created_at", twoHoursAgo)
    .limit(1);

  if (recent && recent.length > 0) {
    console.log("OK — last sync:", recent[0].created_at);
    return;
  }

  // Syncs are down — alert
  console.log("⚠ NO SYNCS IN LAST 2 HOURS");

  // Try to self-heal: test if mssql works
  try {
    require("mssql/msnodesqlv8");
    console.log("mssql module loads OK — issue is elsewhere");
  } catch (e: any) {
    console.log("mssql broken:", e.message);
    console.log("Attempting reinstall...");
    const { execSync } = require("child_process");
    execSync("npm install --no-save mssql msnodesqlv8", { cwd: "C:\\tmp\\dibs-init\\dibs", stdio: "inherit" });
  }

  // Send WhatsApp alert
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://dibs-gov-production.up.railway.app";
  try {
    await fetch(`${SITE}/api/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.INTERNAL_SECRET || "" },
      body: JSON.stringify({ message: "⚠ DIBS sync alert: LamLinks syncs haven't run in 2+ hours. abe_bids, solicitations, shipping, and invoice data may be stale. Check the Windows scheduled tasks on the office machine." }),
    });
    console.log("WhatsApp alert sent");
  } catch {
    console.log("WhatsApp alert failed");
  }

  // Log to sync_log so we can see the alert
  await sb.from("sync_log").insert({ action: "sync_health_alert", details: { message: "No syncs in 2 hours", checked_at: new Date().toISOString() } });
}
main();
