// Check DIBS writeback worker health and fire a WhatsApp alert if things go
// sideways. Intended to run every 5 minutes from the DIBS recurring daemon.
//
// Alerts on:
//   1. Worker heartbeat stale > 5 min (daemon died or LamLinks unreachable)
//   2. Queue has >= 10 rows pending, oldest > 10 min (worker stuck or toggle off
//      while users are submitting)
//
// Debounced via lamlinks_worker_alert_last_sent system_setting: never fires
// more than once per 30 min for the same symptom. So if the daemon is down
// for an hour, you get 2 alerts (start + 30 min in), not 12.
//
// Only runs alerts during work hours (Mon-Fri 6am-8pm local ET) to avoid
// 3am wake-ups.

import "./env";
import { createClient } from "@supabase/supabase-js";

const ALERT_PHONE = process.env.DIBS_ALERT_PHONE || "+15162367397"; // Shmuel default
const ALERT_DEBOUNCE_MIN = 30;
const HEARTBEAT_STALE_SEC = 5 * 60;
const QUEUE_STUCK_MIN = 10;
const QUEUE_STUCK_THRESHOLD = 10;

function inWorkHours(): boolean {
  // Roughly Eastern Time. Server runs in whatever TZ; treat as local clock.
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 Sunday, 6 Saturday
  return day >= 1 && day <= 5 && hour >= 6 && hour < 20;
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.log("[alert] twilio not configured — skipping actual send");
    return false;
  }
  const toNumber = to.replace(/[^0-9+]/g, "");
  const whatsappTo = `whatsapp:${toNumber.startsWith("+") ? toNumber : `+1${toNumber}`}`;
  const whatsappFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;
  const params = new URLSearchParams({ To: whatsappTo, From: whatsappFrom, Body: message });
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );
  if (!resp.ok) {
    console.error(`[alert] twilio ${resp.status}: ${await resp.text()}`);
    return false;
  }
  return true;
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Work-hours gate
  if (!inWorkHours()) {
    console.log("[alert] outside work hours, skipping");
    return;
  }

  // Debounce
  const { data: lastAlertRow } = await sb
    .from("system_settings")
    .select("value")
    .eq("key", "lamlinks_worker_alert_last_sent")
    .maybeSingle();
  if (lastAlertRow?.value) {
    const lastSent = new Date(lastAlertRow.value as any).getTime();
    const minutesSince = (Date.now() - lastSent) / 60_000;
    if (minutesSince < ALERT_DEBOUNCE_MIN) {
      console.log(`[alert] debounced: last alert ${Math.round(minutesSince)} min ago, threshold ${ALERT_DEBOUNCE_MIN}`);
      return;
    }
  }

  // Heartbeat check
  const { data: hbRow } = await sb
    .from("system_settings")
    .select("value")
    .eq("key", "lamlinks_worker_last_heartbeat")
    .maybeSingle();
  const heartbeatAgeSec = hbRow?.value
    ? Math.round((Date.now() - new Date(hbRow.value as any).getTime()) / 1000)
    : null;
  const hbStale = heartbeatAgeSec === null || heartbeatAgeSec > HEARTBEAT_STALE_SEC;

  // Queue stuck check
  const stuckSince = new Date(Date.now() - QUEUE_STUCK_MIN * 60_000).toISOString();
  const { data: stuck } = await sb
    .from("lamlinks_write_queue")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", stuckSince);
  const queueStuck = (stuck?.length || 0) >= QUEUE_STUCK_THRESHOLD;

  const problems: string[] = [];
  if (hbStale) {
    problems.push(
      heartbeatAgeSec === null
        ? "• Worker NEVER sent a heartbeat — daemon likely not running"
        : `• Worker heartbeat stale: ${Math.floor(heartbeatAgeSec / 60)} min old (threshold: 5 min)`
    );
  }
  if (queueStuck) {
    problems.push(`• Queue stuck: ${stuck!.length} pending rows older than ${QUEUE_STUCK_MIN} min`);
  }

  if (problems.length === 0) {
    console.log(`[alert] all healthy: heartbeat ${heartbeatAgeSec}s ago, 0 stuck rows`);
    return;
  }

  const msg =
    `🚨 DIBS LamLinks Worker Alert\n\n` +
    problems.join("\n") +
    `\n\nOn NYEVRVSQL001, run:\n  schtasks /run /tn "DIBS - Recurring Daemon"\n\n` +
    `Or check /settings/lamlinks-writeback for queue detail.`;

  console.log(`[alert] firing:\n${msg}`);
  const ok = await sendWhatsApp(ALERT_PHONE, msg);
  if (ok) {
    await sb
      .from("system_settings")
      .upsert(
        { key: "lamlinks_worker_alert_last_sent", value: new Date().toISOString(), description: "Last time worker-health alert WhatsApp fired. Debounces against spam." },
        { onConflict: "key" }
      );
    console.log(`[alert] sent + debounce timestamp updated`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
