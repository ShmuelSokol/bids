/**
 * Enqueue NSNs for auto-research.
 *
 * Two modes:
 *   1. Incremental (default): scans dibbs_solicitations added since last run
 *      and queues NSNs that need research.
 *   2. Backfill: scans the last N days (from settings.backfill_window_days)
 *      and queues everything needing research.
 *
 *   npx tsx scripts/enqueue-research.ts                 # incremental
 *   npx tsx scripts/enqueue-research.ts --backfill     # past N days
 *   npx tsx scripts/enqueue-research.ts --days 14      # custom window
 *   npx tsx scripts/enqueue-research.ts --dry-run      # show plan, don't enqueue
 *
 * Priority score = potential_value:
 *   - If NSN has a recent award: award_price × sol_quantity
 *   - Else: sol_quantity × $10 baseline
 *   - Unmatched (no AX link) gets +20% bonus since that's where this tool helps most
 *
 * Skips NSNs where research is < cache_fresh_days old.
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes("--dry-run");
const BACKFILL = process.argv.includes("--backfill");
const daysIdx = process.argv.indexOf("--days");
const CUSTOM_DAYS = daysIdx >= 0 ? parseInt(process.argv[daysIdx + 1] ?? "", 10) : null;

async function getSetting(key: string, fallback: string): Promise<string> {
  const { data } = await sb.from("research_settings").select("value").eq("key", key).maybeSingle();
  return data?.value || fallback;
}

async function main() {
  const cacheStaleDays = Number(await getSetting("cache_stale_days", "30"));
  const backfillWindow = Number(await getSetting("backfill_window_days", "14"));
  const windowDays = CUSTOM_DAYS ?? (BACKFILL ? backfillWindow : 2); // incremental = last 2 days
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  console.log(`Window: last ${windowDays} days (since ${since.slice(0, 10)})`);
  console.log(`Cache stale threshold: ${cacheStaleDays} days`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "ENQUEUE"}\n`);

  // Pull solicitations in the window
  const sols: any[] = [];
  for (let p = 0; p < 20; p++) {
    const { data } = await sb
      .from("dibbs_solicitations")
      .select("nsn, nomenclature, quantity, is_sourceable, suggested_price, potential_value, lamlinks_estimated_value, return_by_date, imported_at")
      .gte("imported_at", since)
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    sols.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`Solicitations in window: ${sols.length}`);

  // Build map: NSN → best info we have (highest qty or most recent)
  const byNsn = new Map<string, { quantity: number; is_sourceable: boolean; suggested_price: number | null; est_value: number | null }>();
  for (const s of sols) {
    if (!s.nsn) continue;
    const existing = byNsn.get(s.nsn);
    const qty = Number(s.quantity || 0);
    if (!existing || qty > existing.quantity) {
      byNsn.set(s.nsn, {
        quantity: qty,
        is_sourceable: !!s.is_sourceable,
        suggested_price: s.suggested_price != null ? Number(s.suggested_price) : null,
        est_value: Number(s.lamlinks_estimated_value ?? s.potential_value ?? 0) || null,
      });
    }
  }
  const nsns = [...byNsn.keys()];
  console.log(`Distinct NSNs: ${nsns.length}`);

  // Check existing research status — skip fresh ones
  const existing = new Map<string, { last_researched_at: string | null; queue_status: string }>();
  for (let i = 0; i < nsns.length; i += 1000) {
    const chunk = nsns.slice(i, i + 1000);
    const { data } = await sb
      .from("nsn_research_status")
      .select("nsn, last_researched_at, queue_status")
      .in("nsn", chunk);
    for (const r of data || []) existing.set(r.nsn, r);
  }

  const cacheFreshMs = Number(await getSetting("cache_fresh_days", "7")) * 86_400_000;
  const now = Date.now();
  const toQueue: { nsn: string; priority_score: number }[] = [];
  let skippedFresh = 0;
  let skippedAlreadyQueued = 0;

  for (const nsn of nsns) {
    const status = existing.get(nsn);
    if (status?.queue_status === "queued" || status?.queue_status === "running") {
      skippedAlreadyQueued++;
      continue;
    }
    if (status?.last_researched_at) {
      const age = now - new Date(status.last_researched_at).getTime();
      if (age < cacheFreshMs) {
        skippedFresh++;
        continue;
      }
    }
    // Compute priority
    const info = byNsn.get(nsn)!;
    let priority = 0;
    if (info.suggested_price != null && info.suggested_price > 0) {
      priority = info.suggested_price * info.quantity;
    } else if (info.est_value != null && info.est_value > 0) {
      priority = info.est_value;
    } else {
      priority = info.quantity * 10; // $10/unit baseline
    }
    // Unmatched (no AX source) gets 20% bonus — this is where the tool helps most
    if (!info.is_sourceable) priority *= 1.2;
    toQueue.push({ nsn, priority_score: Math.round(priority * 100) / 100 });
  }

  console.log(`\nSkipped (fresh cache):   ${skippedFresh}`);
  console.log(`Skipped (already queued): ${skippedAlreadyQueued}`);
  console.log(`To enqueue:              ${toQueue.length}`);

  toQueue.sort((a, b) => b.priority_score - a.priority_score);
  console.log(`\nTop 15 by priority (potential value):`);
  for (const q of toQueue.slice(0, 15)) {
    const info = byNsn.get(q.nsn)!;
    console.log(`  $${q.priority_score.toFixed(0).padStart(10)}  ${q.nsn.padEnd(20)}  qty=${info.quantity}  sourceable=${info.is_sourceable ? "Y" : "N"}`);
  }

  if (DRY_RUN) {
    console.log(`\n(dry run — nothing written)`);
    return;
  }
  if (toQueue.length === 0) {
    console.log(`\nNothing to enqueue.`);
    return;
  }

  // Upsert in batches
  let written = 0;
  for (let i = 0; i < toQueue.length; i += 500) {
    const batch = toQueue.slice(i, i + 500).map((q) => ({
      nsn: q.nsn,
      priority_score: q.priority_score,
      queue_status: "queued",
      queued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error, count } = await sb.from("nsn_research_status").upsert(batch, { onConflict: "nsn", count: "exact" });
    if (error) {
      console.error(`batch ${i}: ${error.message}`);
      break;
    }
    written += count ?? batch.length;
  }
  console.log(`\n✅ Enqueued ${written} NSNs for research.`);
  await sb.from("sync_log").insert({
    action: "research_enqueue",
    details: { window_days: windowDays, sols_examined: sols.length, nsns_distinct: nsns.length, enqueued: written, skipped_fresh: skippedFresh, skipped_queued: skippedAlreadyQueued },
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
