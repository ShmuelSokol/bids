/**
 * Enqueue a single precise batch — solicitations imported between --from and --to.
 * Used for "today's batch only" scoping.
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const fromIdx = process.argv.indexOf("--from");
  const toIdx = process.argv.indexOf("--to");
  const from = fromIdx >= 0 ? process.argv[fromIdx + 1] : new Date(Date.now() - 6 * 3600000).toISOString();
  const to = toIdx >= 0 ? process.argv[toIdx + 1] : new Date().toISOString();

  console.log(`Window: ${from} → ${to}`);

  // SPE* + not already_bid — only bidable DLA sols are worth researching.
  const rows: any[] = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await sb
      .from("dibbs_solicitations")
      .select("nsn, quantity, is_sourceable, suggested_price, potential_value, lamlinks_estimated_value, imported_at, solicitation_number, already_bid")
      .gte("imported_at", from)
      .lt("imported_at", to)
      .ilike("solicitation_number", "SPE%")
      .eq("already_bid", false)
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`Sols in window (SPE* + not bid): ${rows.length}`);

  const byNsn = new Map<string, any>();
  for (const s of rows) {
    if (!s.nsn) continue;
    const existing = byNsn.get(s.nsn);
    const qty = Number(s.quantity || 0);
    if (!existing || qty > existing.quantity) {
      byNsn.set(s.nsn, {
        quantity: qty,
        is_sourceable: !!s.is_sourceable,
        suggested_price: Number(s.suggested_price || 0),
        est_value: Number(s.lamlinks_estimated_value || s.potential_value || 0),
      });
    }
  }
  const nsns = [...byNsn.entries()];
  console.log(`Distinct NSNs: ${nsns.length}`);

  // Skip already-researched fresh ones
  const ids = nsns.map(([n]) => n);
  const existing = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const { data } = await sb.from("nsn_research_status").select("nsn, last_researched_at").in("nsn", chunk);
    for (const r of data || []) existing.set(r.nsn, r);
  }
  const freshMs = 7 * 86400000;
  const now = Date.now();

  const toQueue = nsns
    .filter(([n, _]) => {
      const status = existing.get(n);
      if (status?.last_researched_at && now - new Date(status.last_researched_at).getTime() < freshMs) return false;
      return true;
    })
    .map(([n, info]) => {
      let priority = info.suggested_price > 0 ? info.suggested_price * info.quantity :
                     info.est_value > 0 ? info.est_value :
                     info.quantity * 10;
      if (!info.is_sourceable) priority *= 1.2;
      return { nsn: n, priority_score: Math.round(priority * 100) / 100 };
    });

  toQueue.sort((a, b) => b.priority_score - a.priority_score);
  console.log(`To enqueue: ${toQueue.length}`);
  console.log(`Top 5 priority:`);
  for (const q of toQueue.slice(0, 5)) console.log(`  $${q.priority_score.toFixed(0).padStart(10)}  ${q.nsn}`);

  if (process.argv.includes("--dry-run")) {
    console.log("(dry run)");
    return;
  }

  let written = 0;
  for (let i = 0; i < toQueue.length; i += 500) {
    const batch = toQueue.slice(i, i + 500).map((q) => ({
      nsn: q.nsn,
      priority_score: q.priority_score,
      queue_status: "queued",
      queued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { count } = await sb.from("nsn_research_status").upsert(batch, { onConflict: "nsn", count: "exact" });
    written += count ?? batch.length;
  }
  console.log(`✅ Enqueued ${written} NSNs`);
})();
