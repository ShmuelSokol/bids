/**
 * RFQ draft generator service.
 *
 * Given a set of (NSN, qty, optional sol context) needs, finds eligible
 * suppliers via nsn_research_findings, applies rate-limit/dedup rules,
 * and produces draft RFQs in the rfq_drafts table grouped by supplier
 * (multiple NSNs to same supplier → one RFQ).
 *
 * Rules (backend safety net for bulk actions):
 *   1. SUPPLIER MUST HAVE EMAIL — if dibs_suppliers row exists with email,
 *      use it. Else skip and log skip_reason='no_email'. (Manual onboarding
 *      or auto-research email-discovery in Phase 2.x will fill these.)
 *   2. NOT BLOCKED — dibs_suppliers.blocked=false
 *   3. DEDUP per (NSN, supplier) — skip if a non-cancelled draft exists for
 *      this combo created in the last 14 days
 *   4. RATE LIMIT per supplier — max 5 draft+sent in last 24h per vendor
 *   5. CONFIDENCE THRESHOLD — only suppliers with research confidence
 *      >= 0.6 OR known AX vendor (source='ax') OR manual
 *
 * Drafts are NOT auto-sent. They sit in status='draft' until Abe
 * approves via the UI.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildSubject, buildInitialRfq, type RfqLine } from "./rfq-template";

export type GenerateInput = {
  needs: { nsn: string; qty: number; partNumber?: string }[];
  solId?: string;
  source?: "sol_bulk" | "auto_research" | "manual";
  createdBy?: string;
  // Override defaults
  minConfidence?: number;
  rateLimitPerDay?: number;
  dedupWindowDays?: number;
};

export type GenerateResult = {
  draftsCreated: number;
  skipped: number;
  byReason: Record<string, number>;
  // Per-supplier breakdown of what was queued
  details: Array<{
    supplierName: string;
    supplierEmail: string;
    nsns: string[];
    skipped?: string;
  }>;
};

export async function generateRfqDrafts(
  input: GenerateInput,
  sb?: SupabaseClient,
): Promise<GenerateResult> {
  const supabase =
    sb ||
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  const minConfidence = input.minConfidence ?? 0.6;
  const rateLimitPerDay = input.rateLimitPerDay ?? 5;
  const dedupWindowDays = input.dedupWindowDays ?? 14;
  const source = input.source ?? "sol_bulk";

  const result: GenerateResult = {
    draftsCreated: 0,
    skipped: 0,
    byReason: {},
    details: [],
  };
  const bump = (reason: string) => {
    result.skipped++;
    result.byReason[reason] = (result.byReason[reason] || 0) + 1;
  };

  if (input.needs.length === 0) return result;
  const nsns = input.needs.map((n) => n.nsn);

  // 1. Pull research findings for these NSNs
  const { data: findings } = await supabase
    .from("nsn_research_findings")
    .select("nsn, supplier_name, supplier_cage, list_price, lead_time_days, confidence")
    .in("nsn", nsns)
    .eq("superseded", false)
    .gte("confidence", minConfidence);

  if (!findings || findings.length === 0) {
    bump("no_research_findings");
    return result;
  }

  // 2. Pull all suppliers (we'll match by name OR cage)
  const { data: suppliers } = await supabase
    .from("dibs_suppliers")
    .select("id, name, cage, email, blocked, last_rfq_sent, rfq_count_total")
    .not("email", "is", null);
  const suppliersByName = new Map<string, any>();
  const suppliersByCage = new Map<string, any>();
  for (const s of suppliers || []) {
    suppliersByName.set(s.name.toLowerCase(), s);
    if (s.cage) suppliersByCage.set(s.cage.toUpperCase(), s);
  }

  // 3. Group findings by (NSN, supplier) — one row per unique combo
  type SupplierTarget = {
    supplierId: number | null;
    supplierName: string;
    supplierEmail: string | null;
    nsns: { nsn: string; qty: number; partNumber?: string }[];
    blocked: boolean;
  };
  const targets = new Map<string, SupplierTarget>(); // key: supplier name|cage

  for (const f of findings) {
    const need = input.needs.find((n) => n.nsn === f.nsn);
    if (!need) continue;

    // Match supplier
    let supplier =
      (f.supplier_cage && suppliersByCage.get(f.supplier_cage.toUpperCase())) ||
      suppliersByName.get(f.supplier_name.toLowerCase());

    const key = (supplier?.id?.toString()) || `name:${f.supplier_name.toLowerCase()}`;
    let target = targets.get(key);
    if (!target) {
      target = {
        supplierId: supplier?.id || null,
        supplierName: supplier?.name || f.supplier_name,
        supplierEmail: supplier?.email || null,
        nsns: [],
        blocked: !!supplier?.blocked,
      };
      targets.set(key, target);
    }
    if (!target.nsns.find((x) => x.nsn === f.nsn)) {
      target.nsns.push({ nsn: f.nsn, qty: need.qty, partNumber: need.partNumber });
    }
  }

  // 4. Apply per-supplier rules and build drafts
  for (const target of Array.from(targets.values())) {
    if (!target.supplierEmail) {
      bump("no_email");
      result.details.push({
        supplierName: target.supplierName, supplierEmail: "—",
        nsns: target.nsns.map((n) => n.nsn),
        skipped: "no_email — supplier has no email in dibs_suppliers",
      });
      continue;
    }
    if (target.blocked) {
      bump("blocked");
      result.details.push({
        supplierName: target.supplierName, supplierEmail: target.supplierEmail,
        nsns: target.nsns.map((n) => n.nsn),
        skipped: "blocked",
      });
      continue;
    }

    // Rate limit: count drafts (any status) in last 24h
    if (target.supplierId) {
      const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const { count: recent } = await supabase
        .from("rfq_drafts")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", target.supplierId)
        .gte("created_at", since)
        .neq("status", "cancelled");
      if ((recent || 0) >= rateLimitPerDay) {
        bump("rate_limit");
        result.details.push({
          supplierName: target.supplierName, supplierEmail: target.supplierEmail,
          nsns: target.nsns.map((n) => n.nsn),
          skipped: `rate_limit — ${recent} sent in last 24h (max ${rateLimitPerDay})`,
        });
        continue;
      }
    }

    // Dedup per (NSN, supplier) — drop NSNs already RFQ'd in last N days
    const dedupSince = new Date(Date.now() - dedupWindowDays * 24 * 60 * 60_000).toISOString();
    if (target.supplierId) {
      const { data: recentDrafts } = await supabase
        .from("rfq_drafts")
        .select("lines")
        .eq("supplier_id", target.supplierId)
        .gte("created_at", dedupSince)
        .neq("status", "cancelled");
      const alreadySent = new Set<string>();
      for (const r of recentDrafts || []) {
        for (const ln of (r.lines as any[]) || []) {
          if (ln.nsn) alreadySent.add(ln.nsn);
        }
      }
      const before = target.nsns.length;
      target.nsns = target.nsns.filter((n) => !alreadySent.has(n.nsn));
      const dropped = before - target.nsns.length;
      if (dropped > 0) bump(`dedup (${dropped} NSNs dropped)`);
      if (target.nsns.length === 0) {
        result.details.push({
          supplierName: target.supplierName, supplierEmail: target.supplierEmail,
          nsns: [], skipped: "dedup — all NSNs already RFQ'd recently",
        });
        continue;
      }
    }

    // Build draft
    const lines: RfqLine[] = target.nsns.map((n) => ({
      nsn: n.nsn,
      partNumber: n.partNumber,
      qty: n.qty,
    }));
    const firstName = target.supplierName.split(/[ ,]/)[0];
    const subject = buildSubject({ lines });
    const body = buildInitialRfq({ recipientFirstName: firstName, lines });

    const { error } = await supabase.from("rfq_drafts").insert({
      supplier_id: target.supplierId,
      supplier_email: target.supplierEmail,
      supplier_name: target.supplierName,
      subject,
      body,
      lines: lines as any,
      sol_id: input.solId || null,
      source,
      created_by: input.createdBy || "system",
    });
    if (error) {
      bump("insert_failed");
      console.error(`Insert failed for ${target.supplierName}: ${error.message}`);
      continue;
    }

    result.draftsCreated++;
    result.details.push({
      supplierName: target.supplierName, supplierEmail: target.supplierEmail,
      nsns: target.nsns.map((n) => n.nsn),
    });
  }

  return result;
}
