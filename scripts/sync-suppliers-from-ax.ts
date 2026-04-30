/**
 * Sync AX Vendors → Supabase dibs_suppliers (Phase 2.0).
 *
 * Pulls all AX vendors with a non-empty PrimaryEmailAddress and mirrors
 * each into dibs_suppliers. AX is the source of truth for vendors we've
 * shipped against; new-supplier discovery (auto-research with email
 * scraping) is Phase 2.1.
 *
 * Multi-email handling: AX stores multiple addresses semicolon-separated
 * (e.g. "kvanek@flambeau.com; flam-iqms@flambeau.com"). We pick the FIRST
 * as canonical email and stash the rest in email_alternates.
 *
 * Idempotent — uses (ax_vendor_account, ax_data_area) as the conflict key.
 * Manual edits to the row (notes, blocked, last_verified) are preserved
 * since we only upsert AX-sourced fields.
 *
 * Pagination: AX has ~5,597 vendors total but only ~217 have email; well
 * under the silent 1000-row cap. Single fetch is fine for now. If coverage
 * grows past 1000, switch to chunked-by-account-number.
 *
 * Usage:
 *   npx tsx scripts/sync-suppliers-from-ax.ts          (dry run)
 *   npx tsx scripts/sync-suppliers-from-ax.ts --apply  (actually upsert)
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365 = process.env.AX_D365_URL!;
const APPLY = process.argv.includes("--apply");

async function getToken(): Promise<string> {
  const p = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365}/.default`,
  });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: p });
  const d: any = await r.json();
  if (!d.access_token) throw new Error(d.error_description);
  return d.access_token;
}

function splitEmails(raw: string): { primary: string; alternates: string[] } {
  const parts = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { primary: "", alternates: [] };
  return { primary: parts[0].toLowerCase(), alternates: parts.slice(1).map((s) => s.toLowerCase()) };
}

(async () => {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  const token = await getToken();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Pull all AX vendors with non-empty email
  const all: any[] = [];
  let next: string | null = `${D365}/data/Vendors?cross-company=true&$top=1000&$select=VendorAccountNumber,VendorName,PrimaryEmailAddress,dataAreaId&$filter=PrimaryEmailAddress ne ''`;
  let pages = 0;
  while (next) {
    const r = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      console.error(`AX fetch failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
      process.exit(1);
    }
    const d: any = await r.json();
    all.push(...(d.value || []));
    pages++;
    next = d["@odata.nextLink"] || null;
    if (!next && (d.value?.length || 0) === 1000) {
      console.warn(`⚠ Hit 1000-row cap with no nextLink — may be truncated. Add chunking.`);
    }
  }
  console.log(`Fetched ${all.length} vendors (${pages} pages) with non-empty email`);

  // Build upserts. Dedup on (ax_vendor_account, ax_data_area)
  const seen = new Set<string>();
  const upserts: any[] = [];
  for (const v of all) {
    const acct = String(v.VendorAccountNumber || "").trim();
    const area = String(v.dataAreaId || "").trim();
    const key = `${acct}|${area}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { primary, alternates } = splitEmails(v.PrimaryEmailAddress || "");
    if (!primary) continue;

    upserts.push({
      ax_vendor_account: acct,
      ax_data_area: area,
      name: (v.VendorName || "").trim() || acct,
      email: primary,
      email_alternates: alternates.length > 0 ? alternates : null,
      source: "ax",
      confidence: 0.85,  // AX-known vendors have decent confidence by default
    });
  }
  console.log(`Unique vendors with email: ${upserts.length}`);
  console.log(`Sample (first 5):`);
  for (const u of upserts.slice(0, 5)) {
    console.log(`  ${u.ax_vendor_account.padEnd(8)} ${(u.name || "").slice(0, 32).padEnd(32)} → ${u.email}${u.email_alternates ? ` (+${u.email_alternates.length} alt)` : ""}`);
  }

  if (!APPLY) {
    console.log(`\n(Dry run — re-run with --apply to upsert ${upserts.length} rows.)`);
    return;
  }

  // Existing snapshot for diff
  const { data: existing } = await sb
    .from("dibs_suppliers")
    .select("ax_vendor_account, ax_data_area, email")
    .eq("source", "ax");
  const existingMap = new Map(
    (existing || []).map((r: any) => [`${r.ax_vendor_account}|${r.ax_data_area}`, r])
  );
  let toAdd = 0, toUpdate = 0, unchanged = 0;
  for (const u of upserts) {
    const e = existingMap.get(`${u.ax_vendor_account}|${u.ax_data_area}`);
    if (!e) toAdd++;
    else if (e.email !== u.email) toUpdate++;
    else unchanged++;
  }
  console.log(`Diff vs current dibs_suppliers (source=ax): add=${toAdd}, update=${toUpdate}, unchanged=${unchanged}`);

  // Manual dedup against existing AX rows (avoids needing a Postgres
  // unique constraint that matches the upsert conflict key — partial
  // indexes with WHERE don't satisfy ON CONFLICT cleanly).
  const { data: full } = await sb
    .from("dibs_suppliers")
    .select("id, ax_vendor_account, ax_data_area")
    .eq("source", "ax");
  const idMap = new Map(
    (full || []).map((r: any) => [`${r.ax_vendor_account}|${r.ax_data_area}`, r.id])
  );

  let inserted = 0, updated = 0;
  const toInsert: any[] = [];
  for (const u of upserts) {
    const existingId = idMap.get(`${u.ax_vendor_account}|${u.ax_data_area}`);
    if (existingId) {
      const { error } = await sb.from("dibs_suppliers").update(u).eq("id", existingId);
      if (error) { console.error(`update id=${existingId} failed:`, error.message); process.exit(2); }
      updated++;
    } else {
      toInsert.push(u);
    }
  }

  // Bulk insert new rows in chunks of 200
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const slice = toInsert.slice(i, i + CHUNK);
    const { error } = await sb.from("dibs_suppliers").insert(slice);
    if (error) {
      console.error(`insert chunk @${i} failed:`, error.message);
      process.exit(2);
    }
    inserted += slice.length;
    process.stdout.write(`  inserted ${inserted}/${toInsert.length}, updated ${updated}\r`);
  }
  console.log(`\n✓ Inserted ${inserted}, updated ${updated} AX-sourced suppliers`);
  const written = inserted + updated;

  await sb.from("sync_log").insert({
    action: "sync_suppliers_from_ax",
    details: { fetched: all.length, upserted: written, added: toAdd, updated: toUpdate, unchanged },
  });
})().catch((e) => { console.error(e); process.exit(1); });
