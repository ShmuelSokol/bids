/**
 * Discover supplier emails for the unmapped vendors in nsn_research_findings.
 * For each distinct (supplier_name, base_url) NOT yet in dibs_suppliers,
 * fetch contact pages, extract emails, and persist as source='research'.
 *
 * Politeness:
 *   - 2-second delay between suppliers
 *   - 15s fetch timeout per URL
 *   - 7 common path attempts max per supplier
 *   - First page that yields emails wins (stop early)
 *
 * Idempotency:
 *   - If a supplier name already exists in dibs_suppliers, skip
 *     (manual edits + AX rows take priority)
 *   - Inserts source='research' with the highest-scoring email as canonical;
 *     alternates go in email_alternates
 *   - On no-emails-found, still creates a placeholder row with email=NULL
 *     and notes='discovery attempted <date>: no emails found' so we don't
 *     re-try every day
 *
 * Usage:
 *   npx tsx scripts/discover-supplier-emails.ts                 (dry run)
 *   npx tsx scripts/discover-supplier-emails.ts --apply         (write)
 *   npx tsx scripts/discover-supplier-emails.ts --apply --max 20 (limit suppliers)
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { discoverEmailsForUrl } from "../src/lib/email-discovery";

const APPLY = process.argv.includes("--apply");
const maxIdx = process.argv.indexOf("--max");
const MAX = maxIdx >= 0 ? parseInt(process.argv[maxIdx + 1], 10) : 100;
const DELAY_MS = 2000;
const RETRY_AFTER_DAYS = 30;

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Pull every distinct (supplier_name, base_url) from research findings
  console.log(`Loading research findings...`);
  const { data: findings } = await sb
    .from("nsn_research_findings")
    .select("supplier_name, supplier_url")
    .not("supplier_url", "is", null)
    .eq("superseded", false);

  // Pull existing dibs_suppliers (any source) to avoid duplicates
  const { data: existing } = await sb.from("dibs_suppliers").select("name, last_verified, notes");
  const existingByName = new Map<string, any>();
  for (const e of existing || []) existingByName.set(e.name.toLowerCase(), e);

  // Distinct (name, base_url)
  const targets: { name: string; baseUrl: string }[] = [];
  const seen = new Set<string>();
  for (const f of findings || []) {
    if (!f.supplier_url) continue;
    const baseUrl = (f.supplier_url || "").replace(/[?#].*/, "").replace(/\/+$/, "");
    const key = `${f.supplier_name.toLowerCase()}|${baseUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const ex = existingByName.get(f.supplier_name.toLowerCase());
    if (ex) {
      // Skip if attempted within retry window (avoid hammering)
      if (ex.last_verified) {
        const ageMs = Date.now() - new Date(ex.last_verified).getTime();
        if (ageMs < RETRY_AFTER_DAYS * 24 * 60 * 60_000) continue;
      }
      // Already exists → don't re-discover; manual/AX edits take precedence
      if (ex.notes && /discovery attempted/i.test(ex.notes)) continue;
      // Has email already? skip
      // (Note: existing rows from AX/manual won't be touched)
    }
    targets.push({ name: f.supplier_name, baseUrl });
  }
  console.log(`Targets to discover: ${targets.length} (cap ${MAX})`);
  const limited = targets.slice(0, MAX);
  if (!APPLY) {
    console.log(`(dry run — not actually fetching. Use --apply to run discovery.)`);
    for (const t of limited.slice(0, 10)) console.log(`  → ${t.name.slice(0, 30).padEnd(30)} | ${t.baseUrl}`);
    return;
  }

  let withEmails = 0, noEmails = 0, errored = 0;
  for (let i = 0; i < limited.length; i++) {
    const t = limited[i];
    process.stdout.write(`[${i + 1}/${limited.length}] ${t.name.slice(0, 30).padEnd(30)} | ${t.baseUrl.slice(0, 40)} ... `);
    try {
      const r = await discoverEmailsForUrl(t.baseUrl);
      if (r.emails.length === 0) {
        console.log(`no emails (${r.tried.length} pages tried)`);
        noEmails++;
        // Stub row so we don't retry constantly
        await sb.from("dibs_suppliers").insert({
          name: t.name,
          email: null,
          source: "research",
          confidence: 0,
          last_verified: new Date().toISOString(),
          notes: `discovery attempted ${new Date().toISOString().slice(0, 10)}: no emails found in ${r.tried.length} pages. last error: ${(r.lastError || "(none)").slice(0, 200)}`,
        }).then((res) => {
          if (res.error && !res.error.message.includes("duplicate")) {
            console.log(`    upsert err: ${res.error.message}`);
          }
        });
      } else {
        const top = r.emails[0];
        const alt = r.emails.slice(1).map((e) => e.email);
        console.log(`✓ found ${r.emails.length} emails — top: ${top.email} (score ${top.score.toFixed(2)})`);
        withEmails++;
        await sb.from("dibs_suppliers").insert({
          name: t.name,
          email: top.email,
          email_alternates: alt.length > 0 ? alt : null,
          source: "research",
          confidence: top.score,
          last_verified: new Date().toISOString(),
          notes: `discovered ${new Date().toISOString().slice(0, 10)} from ${top.source_url}`,
        }).then((res) => {
          if (res.error && !res.error.message.includes("duplicate")) {
            console.log(`    insert err: ${res.error.message}`);
          }
        });
      }
    } catch (e: any) {
      console.log(`✗ error: ${e?.message?.slice(0, 80)}`);
      errored++;
    }
    // polite delay
    if (i < limited.length - 1) {
      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
  }

  console.log(`\nSummary: withEmails=${withEmails}, noEmails=${noEmails}, errored=${errored}`);
  await sb.from("sync_log").insert({
    action: "discover_supplier_emails",
    details: { attempted: limited.length, withEmails, noEmails, errored },
  });
})().catch((e) => { console.error(e); process.exit(1); });
