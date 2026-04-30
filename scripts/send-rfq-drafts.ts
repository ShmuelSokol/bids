/**
 * Daemon-side RFQ sender. Polls rfq_drafts for status='pending_send'
 * rows, sends each via EWS, updates status to 'sent' (with ews_uid)
 * or 'send_failed' (with send_error).
 *
 * Daemon-side ONLY — Railway can't reach mail.everreadygroup.com.
 *
 * Per-send transition:
 *   1. UPDATE status='sending' (lock)
 *   2. EWS sendMail()
 *   3. UPDATE status='sent', sent_at, ews_uid (or 'send_failed', send_error)
 *   4. UPDATE dibs_suppliers.last_rfq_sent + rfq_count_total++
 *
 * Cadence: 60s — Abe approves a draft, daemon picks it up within a min.
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { sendMail } from "../src/lib/ews-client";

const POLL_INTERVAL_MS = 60_000;
const ONE_SHOT = process.argv.includes("--one-shot");

async function processBatch() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: pending } = await sb
    .from("rfq_drafts")
    .select("id, supplier_id, supplier_email, supplier_name, subject, body")
    .eq("status", "pending_send")
    .order("created_at", { ascending: true })
    .limit(10);

  if (!pending || pending.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  console.log(`Processing ${pending.length} pending RFQ drafts...`);

  let sent = 0, failed = 0;
  for (const d of pending) {
    // Lock — flip to 'sending' first
    const { data: locked } = await sb
      .from("rfq_drafts")
      .update({ status: "sending" })
      .eq("id", d.id)
      .eq("status", "pending_send")
      .select("id");
    if (!locked || locked.length === 0) {
      console.log(`  ${d.id} not in pending_send anymore — skip`);
      continue;
    }

    try {
      await sendMail({
        to: d.supplier_email,
        subject: d.subject,
        body: d.body,
        bodyType: "text",
      });
      await sb.from("rfq_drafts").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        // ews_uid would be returned by sendMail in a future version; null for now
      }).eq("id", d.id);

      // Update supplier counters
      if (d.supplier_id) {
        // Read current count, increment, write back (Supabase RPC inc would be cleaner but this works)
        const { data: cur } = await sb
          .from("dibs_suppliers")
          .select("rfq_count_total")
          .eq("id", d.supplier_id)
          .maybeSingle();
        await sb.from("dibs_suppliers").update({
          last_rfq_sent: new Date().toISOString(),
          rfq_count_total: (cur?.rfq_count_total || 0) + 1,
        }).eq("id", d.supplier_id);
      }
      sent++;
      console.log(`  ✓ #${d.id} → ${d.supplier_email} (${d.subject.slice(0, 50)})`);
    } catch (e: any) {
      const errMsg = (e?.message || String(e)).slice(0, 500);
      await sb.from("rfq_drafts").update({
        status: "send_failed",
        send_error: errMsg,
      }).eq("id", d.id);
      failed++;
      console.log(`  ✗ #${d.id} → ${d.supplier_email} FAILED: ${errMsg.slice(0, 100)}`);
    }
  }

  return { processed: pending.length, sent, failed };
}

(async () => {
  console.log(`RFQ send daemon starting (one-shot=${ONE_SHOT})`);
  if (ONE_SHOT) {
    const r = await processBatch();
    console.log(`Done: ${JSON.stringify(r)}`);
    return;
  }
  while (true) {
    try {
      await processBatch();
    } catch (e: any) {
      console.error(`Loop error: ${e?.message || e}`);
    }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
})().catch((e) => { console.error(e); process.exit(1); });
