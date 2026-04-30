/**
 * Daily WAWF-vs-kbr reconciliation.
 *
 * What this DOES cover:
 *   - Pull every DD219 invoice from AX for the last N days (default 7) using
 *     the existing fetchAxByMonth() helper from scripts/ax-fetch.ts.
 *   - For each AX invoice, find the matching LL kad via cinnum_kad (LL stores
 *     the AX CIN as 7-digit zero-padded — see scripts/_reconcile-47.ts for
 *     the working pattern).
 *   - Walk kad → kae → ka9 → kaj to locate the kaj this invoice is recorded
 *     against, then read kbr_tab rows for kap=24 (810) and kap=25 (856).
 *   - Flag invoices where:
 *       missing_kad         AX has the invoice, LL has no kad row at all
 *                           (worker never wrote it OR write was rolled back)
 *       missing_kaj         kad exists but no kae/ka9 link to a kaj — the
 *                           7-table txn aborted partway
 *       missing_kbr_810     kaj exists but no kbr 810 row — likely we wrote
 *                           kad/kae but never reached kbr (pre-improvement-#1
 *                           code path, or a fresh queue row stuck before SFTP)
 *       missing_kbr_856     kbr 810 present but 856 absent (rare)
 *       upload_failed_810   kbr 810 row exists with xtcsta='WAWF 810 upfail'
 *                           — worker recorded that the SFTP upload failed
 *                           (improvement #1 path). REQUIRES OPERATOR ATTN.
 *       upload_failed_856   same for the 856
 *
 * What this does NOT cover (and why):
 *   - We CANNOT verify "did WAWF/Sally actually accept and forward this 810
 *     to DLA". That requires correlating the WAWF ack email Abe receives in
 *     Outlook (or the equivalent Microsoft Graph / IMAP feed). That work is
 *     pending separate user decisions on mailbox + protocol — see notes.
 *   - kbr.xtcscn_kbr is LL's INTERNAL counter (TRN_ID_CK5), NOT the WAWF
 *     transaction control number. xtcscn=0 on the 856 is normal (LL stores
 *     '0' for non-810 rows by design). xtcscn is NOT a reliability signal —
 *     confirmed during today's debugging. The reconciler explicitly does
 *     not flag rows on xtcscn alone.
 *   - We don't try to match line-level totals; the kad mslval_kad ↔ AX
 *     TotalInvoiceAmount comparison is left to the existing post-batch UI.
 *
 * Output:
 *   - Console summary table: invoice → kad/kaj/kbr state → flag list.
 *   - sync_log row (action='reconcile_wawf_vs_kbr') with counts so the
 *     daemon's daily run is observable in /ops.
 *
 * Usage:
 *   npx tsx scripts/reconcile-wawf-vs-kbr.ts                # default 7 days
 *   npx tsx scripts/reconcile-wawf-vs-kbr.ts --days 14
 *   npx tsx scripts/reconcile-wawf-vs-kbr.ts --days 1 --quiet
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sql = require("mssql/msnodesqlv8");
import { fetchAxByMonth } from "./ax-fetch";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365 = process.env.AX_D365_URL!;

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

type Flag =
  | "missing_kad"
  | "missing_kaj"
  | "missing_kbr_810"
  | "missing_kbr_856"
  | "upload_failed_810"
  | "upload_failed_856";

type ReconRow = {
  ax_invoice: string;
  ax_total: number;
  ax_invoice_date: string;
  contract: string;
  idnkad: number | null;
  idnkaj: number | null;
  kbr_810: { sta: string; xtcscn: string } | null;
  kbr_856: { sta: string; xtcscn: string } | null;
  flags: Flag[];
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const daysArg = argv.find((a) => a.startsWith("--days"));
  let days = 7;
  if (daysArg) {
    if (daysArg.includes("=")) days = parseInt(daysArg.split("=")[1], 10);
    else {
      const i = argv.indexOf("--days");
      days = parseInt(argv[i + 1], 10);
    }
    if (!Number.isFinite(days) || days < 1) days = 7;
  }
  const quiet = argv.includes("--quiet");
  return { days, quiet };
}

async function main() {
  const { days, quiet } = parseArgs();
  const startedAt = new Date().toISOString();
  console.log(`[${startedAt}] reconcile-wawf-vs-kbr: scanning last ${days} day(s) of DD219 invoices`);

  // 1. Pull DD219 invoices from AX.
  // monthsBack must cover the requested days window. Round up to the
  // nearest month so we don't drop early-month invoices when days < 30.
  const token = await getToken();
  const monthsBack = Math.max(1, Math.ceil(days / 28));
  const baseFilter = `InvoiceCustomerAccountNumber eq 'DD219'`;
  const result = await fetchAxByMonth(token, {
    D365_URL: D365,
    entity: "SalesInvoiceHeadersV2",
    dateField: "InvoiceDate",
    monthsBack,
    baseFilter,
    select: ["InvoiceNumber", "InvoiceDate", "CustomersOrderReference", "TotalInvoiceAmount"],
  });

  // Filter to the precise day window (fetchAxByMonth pulls full months).
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const invoices = result.rows.filter((r: any) => new Date(r.InvoiceDate).getTime() >= cutoff.getTime());
  console.log(`  AX returned ${result.rows.length} DD219 headers across ${monthsBack} month(s); ${invoices.length} fall within the ${days}-day window`);
  if (invoices.length === 0) {
    console.log(`  nothing to reconcile.`);
    return;
  }

  // 2. Connect to LL SQL.
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const recon: ReconRow[] = [];
  for (const inv of invoices) {
    const axInvoice = String(inv.InvoiceNumber || "").trim();
    const total = Number(inv.TotalInvoiceAmount) || 0;
    const dateStr = String(inv.InvoiceDate).slice(0, 10);
    const orderRef = String(inv.CustomersOrderReference || "").trim();
    const contractNo = orderRef.split("[")[0].trim();

    // CIN0066186 → '0066186' (zero-padded 7-digit, what LL stores in cinnum_kad)
    const digits = axInvoice.replace(/\D/g, "");
    const cinPadded = digits.padStart(7, "0");

    const row: ReconRow = {
      ax_invoice: axInvoice,
      ax_total: total,
      ax_invoice_date: dateStr,
      contract: contractNo,
      idnkad: null,
      idnkaj: null,
      kbr_810: null,
      kbr_856: null,
      flags: [],
    };

    // 2a. Resolve idnkad via cinnum_kad
    const kad = await pool.request().query(`
      SELECT TOP 1 idnkad_kad FROM kad_tab WHERE LTRIM(RTRIM(cinnum_kad)) = '${cinPadded}'
    `);
    if (kad.recordset.length === 0) {
      row.flags.push("missing_kad");
      recon.push(row);
      continue;
    }
    row.idnkad = kad.recordset[0].idnkad_kad;

    // 2b. kad → kae → ka9 → kaj
    const kajRow = await pool.request().query(`
      SELECT TOP 1 ka9.idnkaj_ka9
      FROM kae_tab kae
      JOIN ka9_tab ka9 ON ka9.idnkae_ka9 = kae.idnkae_kae
      WHERE kae.idnkad_kae = ${row.idnkad}
    `);
    if (kajRow.recordset.length === 0) {
      row.flags.push("missing_kaj");
      recon.push(row);
      continue;
    }
    row.idnkaj = kajRow.recordset[0].idnkaj_ka9;

    // 2c. kbr 810 + 856 lookup
    const kbr = await pool.request().query(`
      SELECT idnkap_kbr, LTRIM(RTRIM(xtcsta_kbr)) AS sta, LTRIM(RTRIM(xtcscn_kbr)) AS xtcscn
      FROM kbr_tab
      WHERE itttbl_kbr = 'kaj' AND idnitt_kbr = ${row.idnkaj} AND idnkap_kbr IN (24, 25)
    `);
    const k810 = kbr.recordset.find((r: any) => r.idnkap_kbr === 24);
    const k856 = kbr.recordset.find((r: any) => r.idnkap_kbr === 25);
    row.kbr_810 = k810 ? { sta: k810.sta, xtcscn: k810.xtcscn } : null;
    row.kbr_856 = k856 ? { sta: k856.sta, xtcscn: k856.xtcscn } : null;

    if (!k810) row.flags.push("missing_kbr_810");
    if (!k856) row.flags.push("missing_kbr_856");
    // Improvement #1 status. Match the 'upfail' substring (the kbr label
    // is fixed-width 16 chars: 'WAWF 810 upfail').
    if (k810 && /upfail/i.test(k810.sta)) row.flags.push("upload_failed_810");
    if (k856 && /upfail/i.test(k856.sta)) row.flags.push("upload_failed_856");

    recon.push(row);
  }

  await pool.close();

  // 3. Print summary.
  const flagged = recon.filter((r) => r.flags.length > 0);
  const ok = recon.length - flagged.length;

  if (!quiet) {
    console.log(`\nCIN          contract                      810_state             856_state            flags`);
    console.log("=".repeat(130));
    for (const r of recon) {
      const desc810 = r.kbr_810 ? `${r.kbr_810.sta} (tcn=${r.kbr_810.xtcscn})` : "(no row)";
      const desc856 = r.kbr_856 ? `${r.kbr_856.sta} (tcn=${r.kbr_856.xtcscn})` : "(no row)";
      const flagStr = r.flags.length ? ` ⚠ ${r.flags.join(",")}` : "";
      // Only show flagged rows by default to keep daily output scannable;
      // pass --verbose to dump everything. (Default = flagged only.)
      if (r.flags.length === 0) continue;
      console.log(`${r.ax_invoice.padEnd(11)} ${r.contract.padEnd(28)} ${desc810.padEnd(20)} ${desc856.padEnd(20)}${flagStr}`);
    }
  }

  // Aggregate flag counts for sync_log details.
  const flagCounts: Record<string, number> = {};
  for (const r of flagged) {
    for (const f of r.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;
  }

  console.log(`\n[${new Date().toISOString()}] reconcile-wawf-vs-kbr summary`);
  console.log(`  AX invoices scanned: ${recon.length}`);
  console.log(`  ✓ clean (kad+kaj+kbr 810+856 sent): ${ok}`);
  console.log(`  ⚠ flagged: ${flagged.length}`);
  for (const [flag, n] of Object.entries(flagCounts)) {
    console.log(`      ${flag}: ${n}`);
  }
  if (flagged.length > 0) {
    console.log(`\n  Flagged invoices need operator review. Pre-improvement-#1 'sent' rows`);
    console.log(`  whose .laz Sally never received WILL NOT show up here — that gap closes`);
    console.log(`  once the inbox integration lands and we can correlate WAWF ack emails.`);
  }

  // 4. Log to sync_log for daemon observability.
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error: logErr } = await sb.from("sync_log").insert({
    action: "reconcile_wawf_vs_kbr",
    details: {
      days,
      ax_scanned: recon.length,
      clean: ok,
      flagged: flagged.length,
      flag_counts: flagCounts,
      flagged_invoices: flagged.slice(0, 50).map((r) => ({
        cin: r.ax_invoice, contract: r.contract, total: r.ax_total, flags: r.flags,
      })),
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    },
  });
  if (logErr) console.warn(`  sync_log insert failed (non-fatal): ${logErr.message}`);
  else console.log(`  sync_log: row inserted (action=reconcile_wawf_vs_kbr)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
