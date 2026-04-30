/**
 * Mine Abe's inbox + sent items for supplier email contacts.
 *
 * Way higher yield than scraping supplier websites — Abe has been
 * emailing real suppliers for years. The contacts that ACTUALLY respond
 * are sitting in his inbox.
 *
 * Strategy:
 *   1. Pull last 365 days of Sent Items + Inbox via EWS (headers only)
 *   2. Build (email, displayName, domain, count, lastSeen) map per address
 *   3. Filter out gov (.mil, dla.mil) + internal (@everreadygroup.com)
 *      + obvious noise (noreply, postmaster, etc.)
 *   4. Match to dibs_suppliers by:
 *      - Display name fuzzy match → existing supplier name (preferred)
 *      - Domain → existing supplier (e.g. mcmaster.com → "McMaster-Carr")
 *      - Otherwise: new supplier with name = display name OR domain
 *   5. For matched suppliers WITHOUT email, UPDATE with this email
 *   6. For NEW suppliers (no match), INSERT with source='inbox-discovery'
 *
 * Confidence scoring per address:
 *   - 1.0 if appeared as both sender AND recipient (real conversation)
 *   - 0.85 if Abe sent ≥3 times to it (he uses it actively)
 *   - 0.7 if appeared as sender ≥3 times (vendor reaches out)
 *   - 0.5 baseline (one-off)
 *
 * Idempotency: writes use last_verified to mark "we've considered this
 * address from inbox already today" — won't double-insert.
 *
 * Usage:
 *   npx tsx scripts/discover-emails-from-inbox.ts                (dry run)
 *   npx tsx scripts/discover-emails-from-inbox.ts --apply        (write)
 *   npx tsx scripts/discover-emails-from-inbox.ts --days 30 --apply  (custom window)
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { harvestContactsFromFolder, type EmailContact } from "../src/lib/ews-client";

const APPLY = process.argv.includes("--apply");
const daysIdx = process.argv.indexOf("--days");
const LOOKBACK_DAYS = daysIdx >= 0 ? parseInt(process.argv[daysIdx + 1], 10) : 365;
const minScoreIdx = process.argv.indexOf("--min-score");
const MIN_SCORE = minScoreIdx >= 0 ? parseFloat(process.argv[minScoreIdx + 1]) : 0.7;

const GOV_DOMAIN_RE = /\.(mil|gov)$|^(dla|navy|army|af|uscg|nasa|fda|usda)\.mil$/i;
const INTERNAL_DOMAIN = "everreadygroup.com";
const NOISE_LOCAL_PARTS = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "abuse", "postmaster", "webmaster", "hostmaster",
  "privacy", "legal", "compliance", "spam",
  "newsletter", "updates",
  "mailer-daemon", "support-noreply",
]);

function scoreContact(c: EmailContact): number {
  if (c.asSender > 0 && c.asRecipient > 0) return 1.0;
  if (c.asRecipient >= 3) return 0.85;
  if (c.asSender >= 3) return 0.7;
  if (c.asRecipient >= 1 || c.asSender >= 1) return 0.5;
  return 0.3;
}

function isFilteredOut(c: EmailContact): boolean {
  const [local, domain] = c.email.split("@");
  if (!domain) return true;
  if (domain === INTERNAL_DOMAIN) return true;
  if (GOV_DOMAIN_RE.test(domain)) return true;
  if (NOISE_LOCAL_PARTS.has(local)) return true;
  // Filter out personal email providers (suppliers usually have business
  // domains; an @gmail.com is more often a personal contact than a vendor)
  if (/^(gmail|yahoo|hotmail|outlook|aol|icloud|protonmail|fastmail)\.com$/i.test(domain)) return true;
  // mailserver / bounce
  if (/^bounces?\./i.test(domain)) return true;
  return false;
}

(async () => {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}, lookback: ${LOOKBACK_DAYS} days`);

  console.log(`\nHarvesting Sent Items (last ${LOOKBACK_DAYS} days)...`);
  const sent = await harvestContactsFromFolder({ folder: "sentitems", lookbackDays: LOOKBACK_DAYS });
  console.log(`  → ${sent.size} unique recipient addresses`);

  console.log(`Harvesting Inbox (last ${LOOKBACK_DAYS} days)...`);
  const inbox = await harvestContactsFromFolder({ folder: "inbox", lookbackDays: LOOKBACK_DAYS });
  console.log(`  → ${inbox.size} unique sender addresses`);

  // Merge — same email may appear in both, sum counts and merge display name
  const merged = new Map<string, EmailContact>();
  const addAll = (m: Map<string, EmailContact>) => {
    for (const c of Array.from(m.values())) {
      const ex = merged.get(c.email);
      if (!ex) { merged.set(c.email, { ...c }); continue; }
      ex.asSender += c.asSender;
      ex.asRecipient += c.asRecipient;
      if (c.lastSeen > ex.lastSeen) ex.lastSeen = c.lastSeen;
      if (c.displayName && c.displayName.length > ex.displayName.length) ex.displayName = c.displayName;
    }
  };
  addAll(sent);
  addAll(inbox);
  console.log(`\nMerged: ${merged.size} unique email addresses across both folders`);

  // Filter
  const candidates: EmailContact[] = [];
  let filtered = 0;
  for (const c of Array.from(merged.values())) {
    if (isFilteredOut(c)) { filtered++; continue; }
    candidates.push(c);
  }
  console.log(`Candidates after filter (gov + internal + noise + personal-domain): ${candidates.length}`);
  console.log(`Filtered out: ${filtered}`);

  // Sort by score desc
  candidates.sort((a, b) => scoreContact(b) - scoreContact(a));

  // Sample
  console.log(`\nTop 15 candidates:`);
  for (const c of candidates.slice(0, 15)) {
    console.log(`  ${scoreContact(c).toFixed(2)}  ${c.email.padEnd(40)} — ${c.displayName.slice(0, 30).padEnd(30)} ` +
      `(sent ${c.asRecipient}, recv ${c.asSender}, last ${c.lastSeen.toISOString().slice(0, 10)})`);
  }

  if (!APPLY) {
    console.log(`\n(Dry run — re-run with --apply to upsert into dibs_suppliers.)`);
    return;
  }

  // Persist
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Pull existing suppliers (we want to know which to update vs insert)
  const { data: existing } = await sb.from("dibs_suppliers").select("id, name, email, source");
  const byEmail = new Map((existing || []).filter((s: any) => s.email).map((s: any) => [s.email.toLowerCase(), s]));
  const byNameLower = new Map((existing || []).map((s: any) => [s.name.toLowerCase(), s]));
  const byDomain = new Map<string, any>();
  for (const s of existing || []) {
    if (s.email) {
      const d = s.email.split("@")[1];
      if (d && !byDomain.has(d)) byDomain.set(d, s);
    }
  }

  let inserted = 0, updated = 0, skipped = 0;
  for (const c of candidates) {
    const score = scoreContact(c);
    if (score < MIN_SCORE) { skipped++; continue; }

    // If this exact email already exists, skip
    if (byEmail.has(c.email)) { skipped++; continue; }

    // Match by display name → existing supplier
    let target = c.displayName ? byNameLower.get(c.displayName.toLowerCase()) : null;
    // Match by domain → existing supplier (only if its existing email is from same domain)
    if (!target) target = byDomain.get(c.domain);

    if (target && !target.email) {
      // Existing supplier without email — fill it in
      const { error } = await sb.from("dibs_suppliers").update({
        email: c.email,
        confidence: score,
        last_verified: new Date().toISOString(),
        notes: `inbox discovery ${new Date().toISOString().slice(0, 10)}: ${c.displayName || c.email} (${c.asRecipient} sent, ${c.asSender} recv)`,
      }).eq("id", target.id);
      if (error) console.log(`  upd err for id=${target.id}: ${error.message}`);
      else updated++;
    } else if (target && target.email) {
      // Existing supplier WITH email — add this as alternate
      const { data: cur } = await sb.from("dibs_suppliers").select("email_alternates").eq("id", target.id).maybeSingle();
      const existingAlts = (cur?.email_alternates as string[]) || [];
      if (!existingAlts.includes(c.email) && cur?.email_alternates !== null) {
        await sb.from("dibs_suppliers").update({
          email_alternates: [...existingAlts, c.email],
        }).eq("id", target.id);
        updated++;
      } else {
        skipped++;
      }
    } else {
      // Brand new supplier — INSERT
      const supplierName = c.displayName || c.email.split("@")[0];
      const { error } = await sb.from("dibs_suppliers").insert({
        name: supplierName.slice(0, 200),
        email: c.email,
        source: "research",
        confidence: score,
        last_verified: new Date().toISOString(),
        notes: `inbox discovery ${new Date().toISOString().slice(0, 10)}: ${c.asRecipient} sent, ${c.asSender} recv, last ${c.lastSeen.toISOString().slice(0, 10)}`,
      });
      if (error && !error.message.includes("duplicate")) {
        console.log(`  insert err for ${c.email}: ${error.message}`);
      } else if (!error) {
        inserted++;
      } else {
        skipped++;
      }
    }
  }
  console.log(`\nSummary: inserted=${inserted}, updated=${updated}, skipped=${skipped}`);

  await sb.from("sync_log").insert({
    action: "discover_emails_from_inbox",
    details: {
      lookback_days: LOOKBACK_DAYS,
      sent_addresses: sent.size,
      inbox_addresses: inbox.size,
      merged: merged.size,
      candidates: candidates.length,
      inserted, updated, skipped,
    },
  });
})().catch((e) => { console.error(e); process.exit(1); });
