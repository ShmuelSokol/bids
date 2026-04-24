/**
 * Daily digest of aging WAWF 810 invoices. Computes the same bucketing as
 * /ops/lamlinks/ack-tracker, logs a summary + per-invoice detail, and
 * (optionally) fires a WhatsApp alert when actionable count crosses a
 * threshold.
 *
 *   npx tsx scripts/ack-tracker-digest.ts                   # print only
 *   npx tsx scripts/ack-tracker-digest.ts --alert           # WhatsApp if actionable > 0
 *   npx tsx scripts/ack-tracker-digest.ts --alert --min 5   # WhatsApp if >= 5 actionable
 *
 * Intended for daily scheduled execution. Runs in <1s — just Supabase reads.
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Bucket = "awaiting" | "aging" | "stale" | "probable_reject";

function bucketize(days: number): Bucket {
  if (days < 15) return "awaiting";
  if (days < 30) return "aging";
  if (days < 45) return "stale";
  return "probable_reject";
}

async function main() {
  const alertFlag = process.argv.includes("--alert");
  const minIdx = process.argv.indexOf("--min");
  const minActionable = minIdx >= 0 ? parseInt(process.argv[minIdx + 1] ?? "1", 10) : 1;

  // 60-day window matches the ack-tracker UI. Older transmissions are
  // either long-since paid or long-since escalated — no action value.
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();

  // Pull every 810 from the window, paginated (we have 4k+ rows)
  const transmissions: any[] = [];
  for (let page = 0; page < 20; page++) {
    const { data } = await sb
      .from("ll_edi_transmissions")
      .select("id, idnkbr, parent_id, parent_table, transmitted_at")
      .eq("edi_type", "810")
      .gte("transmitted_at", since)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    transmissions.push(...data);
    if (data.length < 1000) break;
  }

  const now = Date.now();
  const rows = transmissions.map((t: any) => {
    const ms = now - new Date(t.transmitted_at).getTime();
    const days = Math.floor(ms / 86_400_000);
    return { ...t, days, bucket: bucketize(days) };
  });

  const byBucket: Record<Bucket, number> = { awaiting: 0, aging: 0, stale: 0, probable_reject: 0 };
  for (const r of rows) byBucket[r.bucket as Bucket]++;
  const actionable = byBucket.stale + byBucket.probable_reject;

  const kajIds = Array.from(
    new Set(
      rows
        .filter((r) => (r.bucket === "stale" || r.bucket === "probable_reject") && r.parent_table === "kaj")
        .map((r) => r.parent_id)
        .filter((v) => v != null)
    )
  );

  // Pull details only for actionable rows — uses the kaj-level sync
  const shipmentsByKaj = new Map<number, any>();
  if (kajIds.length > 0) {
    for (let i = 0; i < kajIds.length; i += 500) {
      const chunk = kajIds.slice(i, i + 500);
      const { data } = await sb
        .from("ll_shipments_by_kaj")
        .select("idnkaj, ship_number, contract_number, first_nsn, first_description, total_value")
        .in("idnkaj", chunk);
      for (const s of data || []) {
        if (s.idnkaj != null) {
          shipmentsByKaj.set(Number(s.idnkaj), {
            idnkaj: s.idnkaj,
            ship_number: s.ship_number,
            contract_number: s.contract_number,
            nsn: s.first_nsn,
            description: s.first_description,
            sell_value: s.total_value,
          });
        }
      }
    }
  }

  const actionableRows = rows
    .filter((r) => r.bucket === "stale" || r.bucket === "probable_reject")
    .map((r) => ({
      ...r,
      ship: r.parent_table === "kaj" ? shipmentsByKaj.get(Number(r.parent_id)) : null,
    }))
    .sort((a, b) => b.days - a.days);

  const actionableValue = actionableRows.reduce((s, r) => s + (r.ship?.sell_value || 0), 0);

  // Console output — useful for scheduled runs that pipe to log
  const now_iso = new Date().toISOString();
  console.log(`\n=== WAWF 810 Ack Digest — ${now_iso} ===`);
  console.log(`\nTransmissions in window (120d):   ${rows.length}`);
  console.log(`  Awaiting (0-14d):               ${byBucket.awaiting}`);
  console.log(`  Aging (15-29d):                 ${byBucket.aging}`);
  console.log(`  Stale (30-44d):                 ${byBucket.stale}`);
  console.log(`  Probable reject (45+d):         ${byBucket.probable_reject}`);
  console.log(`\n  Actionable (stale + reject):  ${actionable}`);
  console.log(`  Receivables at risk:            $${actionableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

  if (actionableRows.length > 0) {
    console.log(`\n--- Actionable invoices (oldest first) ---`);
    for (const r of actionableRows.slice(0, 50)) {
      console.log(
        `  ${String(r.days).padStart(4)}d  ${r.bucket.padEnd(17)}  ` +
          `ship=${r.ship?.ship_number || "?"}  ` +
          `cnt=${r.ship?.contract_number || "?"}  ` +
          `nsn=${r.ship?.nsn || "?"}  ` +
          `$${(r.ship?.sell_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      );
    }
    if (actionableRows.length > 50) console.log(`  ... and ${actionableRows.length - 50} more`);
  }

  // Sync log
  await sb.from("sync_log").insert({
    action: "ack_tracker_digest",
    details: {
      total: rows.length,
      by_bucket: byBucket,
      actionable,
      actionable_value: actionableValue,
    },
  });

  // Optional WhatsApp alert
  if (alertFlag && actionable >= minActionable) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWa = process.env.TWILIO_WHATSAPP_FROM;
    const toWa = "whatsapp:+15162367397"; // Yosef

    if (!accountSid || !authToken || !fromWa) {
      console.log(`\n(Skipping WhatsApp — missing Twilio env vars)`);
    } else {
      const body =
        `*WAWF Ack Alert*\n\n` +
        `${actionable} invoice${actionable === 1 ? "" : "s"} aging >30 days without payment ` +
        `($${actionableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} at risk).\n\n` +
        actionableRows
          .slice(0, 5)
          .map(
            (r) =>
              `• ${r.days}d — ${r.ship?.contract_number || "?"} — ` +
              `$${(r.ship?.sell_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          )
          .join("\n") +
        (actionableRows.length > 5 ? `\n... +${actionableRows.length - 5} more` : "") +
        `\n\nFull list: https://dibs-gov-production.up.railway.app/ops/lamlinks/ack-tracker`;

      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: fromWa, To: toWa, Body: body }).toString(),
      });
      if (resp.ok) console.log(`\n✓ WhatsApp alert sent to Yosef`);
      else console.log(`\n✗ WhatsApp send failed: ${resp.status} ${await resp.text()}`);
    }
  } else if (alertFlag) {
    console.log(`\n(No alert: actionable count ${actionable} below threshold ${minActionable})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
