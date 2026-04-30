/**
 * Sally-down detection. Polls sftp.lamlinks.com:/incoming/ for files
 * older than STUCK_THRESHOLD_MINUTES. If our (everready) files are
 * stuck, fire a WhatsApp alert + log to sync_log.
 *
 * Sally normally processes new .laz files within minutes of arrival.
 * If multiple files sit unprocessed past the threshold → Sally is
 * down/backlogged on LL's side and we need to know so:
 *   - DIBS automation can be paused (no point uploading more)
 *   - Yosef can be alerted to escalate to LL support
 *   - We don't sit unaware for hours/days losing transmissions
 *
 * Designed to run periodically via the recurring daemon (every 5-10 min).
 *
 * Single-pass usage:  npx tsx scripts/check-sally-stuck-files.ts
 */
import "./env";
import Sftp from "ssh2-sftp-client";
import { createClient } from "@supabase/supabase-js";

const STUCK_THRESHOLD_MINUTES = 30;          // alert if any of our files older than this
const ALERT_DEBOUNCE_MINUTES = 60;           // don't re-alert within this window

async function sendWhatsAppAlert(message: string): Promise<void> {
  // Reuses the existing /api/whatsapp/send route. Uses the production URL
  // because Twilio creds + recipient list live in Railway env, not local.
  const url = process.env.DIBS_WHATSAPP_ALERT_URL || "https://dibs-gov-production.up.railway.app/api/whatsapp/send";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": process.env.DIBS_INTERNAL_TOKEN || "" },
      body: JSON.stringify({ message, channel: "alerts" }),
    });
    if (!res.ok) console.log(`  WhatsApp alert failed: HTTP ${res.status}`);
  } catch (e: any) {
    console.log(`  WhatsApp alert send error: ${e.message?.slice(0, 80)}`);
  }
}

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1. List /incoming/
  const sftp = new Sftp();
  await sftp.connect({
    host: "sftp.lamlinks.com",
    port: 22,
    username: "lamlinks_inp",
    password: process.env.LL_SFTP_PASS!,
    readyTimeout: 15000,
    hostVerifier: () => true,
  });
  const list = await sftp.list("/incoming");
  await sftp.end();

  const now = Date.now();
  const cutoff = now - STUCK_THRESHOLD_MINUTES * 60_000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60_000;
  const ourStuck = list.filter((f: any) => {
    if (!f.name.includes("everready")) return false;
    if (!f.name.endsWith(".laz")) return false;        // ignore old .txt etc
    const mtime = (f as any).modifyTime;
    if (!mtime) return false;
    if (mtime < now - SEVEN_DAYS) return false;        // ignore historical drift
    return mtime < cutoff;
  });
  const allStuck = list.filter((f: any) => {
    const mtime = (f as any).modifyTime;
    return mtime && mtime < cutoff;
  });

  console.log(`Sally-down check at ${new Date().toISOString()}`);
  console.log(`  /incoming/ total: ${list.length} files`);
  console.log(`  Files older than ${STUCK_THRESHOLD_MINUTES} min: ${allStuck.length} (${ourStuck.length} ours)`);

  if (ourStuck.length === 0) {
    console.log("✓ No stuck everready files — Sally is processing normally.");
    return;
  }

  // 2. Check debounce — don't spam alerts. Look at sync_log for last alert.
  const { data: lastAlert } = await sb
    .from("sync_log")
    .select("created_at")
    .eq("action", "sally_stuck_alert")
    .order("created_at", { ascending: false })
    .limit(1);
  const lastAt = lastAlert?.[0]?.created_at ? new Date(lastAlert[0].created_at).getTime() : 0;
  const debounceCutoff = now - ALERT_DEBOUNCE_MINUTES * 60_000;
  if (lastAt > debounceCutoff) {
    const minsAgo = Math.round((now - lastAt) / 60_000);
    console.log(`  ⏸ Last alert was ${minsAgo} min ago — within debounce window (${ALERT_DEBOUNCE_MINUTES} min). Skip.`);
    return;
  }

  // 3. Compose + send alert
  const oldest = ourStuck.reduce((a: any, b: any) => (a.modifyTime < b.modifyTime ? a : b));
  const ageMin = Math.round((now - (oldest as any).modifyTime) / 60_000);
  const msg = [
    `🚨 LL Sally appears DOWN`,
    `${ourStuck.length} of our .laz files stuck in /incoming/`,
    `Oldest: ${(oldest as any).name} (${ageMin} min)`,
    `Total stuck (all customers): ${allStuck.length}`,
    `→ Pause DIBS invoice writeback, contact Yosef`,
  ].join("\n");

  console.log(`\n⚠ ALERT: ${ourStuck.length} stuck files, oldest ${ageMin} min`);
  console.log(`   Sample: ${(oldest as any).name}`);

  await sendWhatsAppAlert(msg);
  await sb.from("sync_log").insert({
    action: "sally_stuck_alert",
    details: {
      stuck_count_ours: ourStuck.length,
      stuck_count_total: allStuck.length,
      oldest_file: (oldest as any).name,
      oldest_age_minutes: ageMin,
      stuck_files: ourStuck.slice(0, 20).map((f: any) => f.name),
    },
  });
  console.log("✓ Alert sent + logged to sync_log");
})().catch(e => { console.error(e); process.exit(1); });
