/**
 * Research worker — polls nsn_research_status.queue_status='queued',
 * picks up to N NSNs by priority, calls Claude, saves findings.
 * Respects daily budget cap and cache freshness.
 *
 *   npx tsx scripts/research-worker.ts              # one pass
 *   npx tsx scripts/research-worker.ts --loop       # long-running (for daemon)
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { researchNsn, ResearchCandidate } from "../src/lib/nsn-research";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOOP = process.argv.includes("--loop");
const LOOP_INTERVAL_MS = 30_000;
const MAX_PER_PASS = 10;

type SettingsMap = Record<string, string>;

async function loadSettings(): Promise<SettingsMap> {
  const { data } = await sb.from("research_settings").select("key, value");
  const out: SettingsMap = {};
  for (const r of data || []) out[r.key] = r.value;
  return out;
}

async function todaysSpend(): Promise<{ usd: number; calls: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("research_spend_ledger")
    .select("total_usd, call_count")
    .eq("date", today)
    .maybeSingle();
  return { usd: Number(data?.total_usd || 0), calls: Number(data?.call_count || 0) };
}

async function recordSpend(costUsd: number) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await sb
    .from("research_spend_ledger")
    .select("total_usd, call_count")
    .eq("date", today)
    .maybeSingle();
  await sb.from("research_spend_ledger").upsert(
    {
      date: today,
      total_usd: Number(existing?.total_usd || 0) + costUsd,
      call_count: Number(existing?.call_count || 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date" }
  );
}

async function getErgSuppliers(): Promise<{ cage: string; name: string }[]> {
  // Pull from vendor_parts (we have ~30K) — distinct vendor accounts
  const { data } = await sb
    .from("vendor_parts")
    .select("vendor_account, vendor_description")
    .limit(2000);
  const map = new Map<string, string>();
  for (const r of data || []) {
    if (r.vendor_account && !map.has(r.vendor_account)) {
      // vendor_account in ERG's AX isn't always a CAGE; we pass both name + account
      map.set(r.vendor_account, r.vendor_description || r.vendor_account);
    }
  }
  return [...map.entries()].map(([cage, name]) => ({ cage, name })).slice(0, 50);
}

async function getRecentWinners(nsn: string): Promise<{ cage: string; price: number; date: string }[]> {
  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-");
  const { data } = await sb
    .from("awards")
    .select("cage, unit_price, award_date")
    .eq("fsc", fsc)
    .eq("niin", niin)
    .order("award_date", { ascending: false })
    .limit(5);
  return (data || []).map((a: any) => ({
    cage: String(a.cage || "").trim(),
    price: Number(a.unit_price || 0),
    date: String(a.award_date || "").slice(0, 10),
  }));
}

async function getSolicitationContext(nsn: string): Promise<any> {
  // Most recent sol for this NSN
  const { data } = await sb
    .from("dibbs_solicitations")
    .select("quantity, fob, nomenclature, approved_parts")
    .eq("nsn", nsn)
    .order("return_by_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function processOne(nsn: string, settings: SettingsMap): Promise<{ ok: boolean; cost: number; reason?: string }> {
  const model = settings.model_primary || "claude-haiku-4-5-20251001";
  const maxCandidates = Number(settings.max_candidates_per_nsn || "6");

  // Gather context in parallel
  const [solCtx, winners, ergSuppliers] = await Promise.all([
    getSolicitationContext(nsn),
    getRecentWinners(nsn),
    getErgSuppliers(),
  ]);

  const t0 = Date.now();
  try {
    // approved_parts is JSON — may contain { cage, part_number } entries
    let mfrHint: string | null = null;
    let pnHint: string | null = null;
    try {
      const parts = solCtx?.approved_parts;
      if (Array.isArray(parts) && parts.length > 0) {
        mfrHint = parts[0]?.cage || null;
        pnHint = parts[0]?.part_number || null;
      }
    } catch {}

    const { output, call } = await researchNsn(
      {
        nsn,
        nomenclature: solCtx?.nomenclature || null,
        manufacturer_hint: mfrHint,
        manufacturer_part_number: pnHint,
        quantity: solCtx?.quantity || null,
        fob: solCtx?.fob || null,
        recent_winners: winners,
        erg_suppliers: ergSuppliers,
        max_candidates: maxCandidates,
      },
      model
    );

    // Record the run
    const { data: runRow } = await sb
      .from("nsn_research_runs")
      .insert({
        nsn,
        source: `claude_${model.replace(/^claude-/, "").replace(/-.+$/, "")}`,
        status: output.no_results_reason ? "no_results" : "ok",
        cost_usd: call.costUsd,
        duration_ms: call.durationMs,
        input_tokens: call.inputTokens,
        output_tokens: call.outputTokens,
        raw_response: call.text.slice(0, 20000),
      })
      .select("id")
      .single();

    // Supersede any existing LLM findings (keep past_awards + ax_supplier_match)
    await sb
      .from("nsn_research_findings")
      .update({ superseded: true })
      .eq("nsn", nsn)
      .like("source", "claude%");

    // Insert candidates
    const candidateRows = (output.candidates || []).map((c: ResearchCandidate) => {
      const ergMatch = ergSuppliers.find(
        (e) => e.name.toLowerCase().includes(c.supplier_name.toLowerCase()) ||
               c.supplier_name.toLowerCase().includes(e.name.toLowerCase())
      );
      return {
        nsn,
        supplier_name: c.supplier_name,
        supplier_cage: c.supplier_cage || ergMatch?.cage || null,
        supplier_url: c.supplier_url,
        product_url: c.product_url,
        list_price: c.estimated_list_price,
        moq: c.moq,
        lead_time_days: c.lead_time_days,
        is_manufacturer: c.is_manufacturer,
        erg_has_account: !!ergMatch || c.erg_has_account,
        confidence: c.confidence,
        source: `claude_${model.replace(/^claude-/, "").replace(/-.+$/, "")}`,
        rationale: c.rationale,
      };
    });
    if (candidateRows.length > 0) {
      await sb.from("nsn_research_findings").insert(candidateRows);
    }

    // Update status
    const top = candidateRows[0];
    await sb.from("nsn_research_status").upsert(
      {
        nsn,
        last_researched_at: new Date().toISOString(),
        last_run_id: runRow?.id,
        candidate_count: candidateRows.length,
        top_supplier_name: top?.supplier_name ?? null,
        top_supplier_cage: top?.supplier_cage ?? null,
        top_list_price: top?.list_price ?? null,
        top_confidence: top?.confidence ?? null,
        any_erg_account: candidateRows.some((r) => r.erg_has_account),
        queue_status: "idle",
        refresh_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "nsn" }
    );

    await recordSpend(call.costUsd);
    console.log(
      `  ${nsn.padEnd(20)} ✓ ${candidateRows.length} candidates  $${call.costUsd.toFixed(4)}  ${call.durationMs}ms  ${
        output.no_results_reason ? "(no results: " + output.no_results_reason.slice(0, 50) + ")" : ""
      }`
    );
    return { ok: true, cost: call.costUsd };
  } catch (e: any) {
    await sb.from("nsn_research_runs").insert({
      nsn,
      source: `claude_${model.replace(/^claude-/, "").replace(/-.+$/, "")}`,
      status: "error",
      duration_ms: Date.now() - t0,
      error_message: e.message?.slice(0, 500),
    });
    await sb.from("nsn_research_status").upsert(
      { nsn, queue_status: "failed", updated_at: new Date().toISOString() },
      { onConflict: "nsn" }
    );
    console.error(`  ${nsn.padEnd(20)} ✗ ${e.message?.slice(0, 100)}`);
    return { ok: false, cost: 0, reason: e.message };
  }
}

async function runOnePass() {
  const settings = await loadSettings();
  if (settings.research_enabled !== "true") {
    console.log("research_enabled=false — skipping pass");
    return;
  }
  const dailyBudget = Number(settings.daily_budget_usd || "20");
  const spend = await todaysSpend();
  if (spend.usd >= dailyBudget) {
    console.log(`daily budget reached: $${spend.usd.toFixed(2)} / $${dailyBudget} (${spend.calls} calls) — waiting for tomorrow`);
    return;
  }
  const remaining = dailyBudget - spend.usd;
  console.log(`[research] budget left today: $${remaining.toFixed(2)} (spent $${spend.usd.toFixed(2)} in ${spend.calls} calls)`);

  // Pull top-priority queued NSNs
  const { data: queued } = await sb
    .from("nsn_research_status")
    .select("nsn, priority_score, queue_status, last_researched_at")
    .eq("queue_status", "queued")
    .order("priority_score", { ascending: false })
    .limit(MAX_PER_PASS);

  if (!queued || queued.length === 0) {
    console.log(`[research] queue empty`);
    return;
  }
  console.log(`[research] processing ${queued.length} NSNs`);

  let spentThisPass = 0;
  for (const q of queued) {
    if (spend.usd + spentThisPass >= dailyBudget) {
      console.log(`  (budget reached mid-pass — stopping)`);
      break;
    }
    // Mark running (poor-man's lock)
    await sb
      .from("nsn_research_status")
      .update({ queue_status: "running", updated_at: new Date().toISOString() })
      .eq("nsn", q.nsn)
      .eq("queue_status", "queued");
    const result = await processOne(q.nsn, settings);
    spentThisPass += result.cost;
  }
  console.log(`[research] pass complete, spent $${spentThisPass.toFixed(4)} this pass`);
}

async function main() {
  if (!LOOP) {
    await runOnePass();
    return;
  }
  console.log("[research] loop mode — poll every 30s");
  while (true) {
    try {
      await runOnePass();
    } catch (e: any) {
      console.error(`[research] loop error:`, e.message);
    }
    await new Promise((r) => setTimeout(r, LOOP_INTERVAL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
