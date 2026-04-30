/**
 * Parse WAWF acceptance/rejection emails from Abe's inbox via EWS, match
 * each to its LL kaj, and update kbr accordingly.
 *
 * Why: yesterday's batch revealed that LL kbr can falsely say "WAWF X sent"
 * even when WAWF never accepted the file (silent SFTP failure → CIN0066268)
 * OR when the file was rejected (UoM B1 → CIN0066270). The only authoritative
 * proof of WAWF state is the noreply email itself.
 *
 * What this does (Phase 1):
 *   1. Fetch new emails from disa.ogden.eis.mbx.wawfnoreply@mail.mil
 *      since the last successful run (or default 24h on first run)
 *   2. For each: parse form type (810/856), CIN, contract, shipment number,
 *      WAWF TCN, and outcome (accept / accept-with-mods / reject)
 *   3. Match to LL kaj via cinnum_kad lookup
 *   4. Take action:
 *      - Accept → UPDATE kbr.xtcscn with the real WAWF TCN (so reconciler
 *        has positive proof)
 *      - Reject (real, e.g. UoM/duplicate/contract) → DELETE the false kbr
 *        row + WhatsApp Abe with CIN/contract/error
 *      - Reject (benign — "no Acceptor at Location") → restore kbr to "sent"
 *        (per Abe's note these don't actually block payment)
 *      - Unparseable → log + skip
 *   5. Persist each parsed email to wawf_email_log so we don't double-process
 *      and so /ops/wawf-emails can render history
 *
 * Daemon-side ONLY — uses EWS to mail.everreadygroup.com which is not
 * reachable from Railway. Run on GLOVE via the recurring daemon.
 *
 * Lookback strategy:
 *   - Find max(received_at) from wawf_email_log
 *   - Look back from that minus 5min buffer (or 24h if first run)
 *   - Dedup by ews_uid (UNIQUE constraint catches re-fetches)
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
import { fetchFromSender, type WawfFetchedEmail } from "../src/lib/ews-client";

const WAWF_SENDER = "disa.ogden.eis.mbx.wawfnoreply@mail.mil";

type ParsedEmail = {
  formType: "810" | "856" | null;
  contractNo: string | null;     // e.g. SPE2DS26P1577
  cin: string | null;            // e.g. 0066250
  shipmentNo: string | null;     // e.g. SZY0001Z
  wawfTcn: string | null;
  outcome: "accepted" | "accepted_with_modifications" | "rejected" | "rejected_benign" | "unparseable";
  errorText: string | null;
};

const BENIGN_REJECT_PATTERNS = [
  /not a registered user for the role of Acceptor/i,
  /No registered user.*Acceptor.*Location Code/i,
];

function parseEmailBody(subject: string, body: string): ParsedEmail {
  const result: ParsedEmail = {
    formType: null, contractNo: null, cin: null, shipmentNo: null,
    wawfTcn: null, outcome: "unparseable", errorText: null,
  };

  // Form type from subject + body
  const subjLower = subject.toLowerCase();
  const isReject = /failed import\(s\)/i.test(subject) || /had no successful imports/i.test(body);
  const isAcceptWithMods = /successful imports with modifications/i.test(body);
  const isAccept = /successful import\(s\)/i.test(subject) && !isReject;

  // Form type: "Form Type: CI" = 810, "Form Type: RR" = 856
  const formTypeMatch = body.match(/Form Type:\s*(CI|RR)/i);
  if (formTypeMatch) {
    result.formType = formTypeMatch[1].toUpperCase() === "CI" ? "810" : "856";
  } else {
    // Try filename: ".810" or ".856" suffix
    const fn = body.match(/Import File:.*\.(810|856)\b/i);
    if (fn) result.formType = fn[1] as "810" | "856";
  }

  // Contract Number: SPE2DS26P1577
  const contractMatch = body.match(/Contract Number:\s*([A-Z0-9-]+)/i);
  if (contractMatch) result.contractNo = contractMatch[1].trim();

  // Invoice Number: 0066250
  const cinMatch = body.match(/Invoice Number:\s*(\S+)/i);
  if (cinMatch) result.cin = cinMatch[1].trim();

  // Shipment Number: SZY0001Z
  const shipMatch = body.match(/Shipment Number:\s*(\S+)/i);
  if (shipMatch) result.shipmentNo = shipMatch[1].trim();

  // Transaction Set Control Number: 027594676
  const tcnMatch = body.match(/Transaction Set Control Number:\s*(\d+)/i);
  if (tcnMatch) result.wawfTcn = tcnMatch[1].trim();

  // Error line(s) — capture all "ERROR: ..." lines
  const errorLines: string[] = [];
  const errorPattern = /^ERROR:\s*(.+)$/gim;
  let m;
  while ((m = errorPattern.exec(body)) !== null) {
    errorLines.push(m[1].trim());
  }
  if (errorLines.length > 0) result.errorText = errorLines.join("\n");

  // Outcome
  if (isReject) {
    const isBenign = errorLines.some((line) =>
      BENIGN_REJECT_PATTERNS.some((p) => p.test(line))
    );
    result.outcome = isBenign ? "rejected_benign" : "rejected";
  } else if (isAcceptWithMods) {
    result.outcome = "accepted_with_modifications";
  } else if (isAccept) {
    result.outcome = "accepted";
  }

  // If we extracted nothing identifying, mark unparseable
  if (!result.formType && !result.cin && !result.contractNo) {
    result.outcome = "unparseable";
  }

  return result;
}

async function findKajForCin(pool: sql.ConnectionPool, cinNum: string): Promise<number | null> {
  const padded = cinNum.replace(/\D/g, "").padStart(7, "0");
  const r = await pool.request().query(`
    SELECT TOP 1 ka9.idnkaj_ka9
    FROM kad_tab kad
    JOIN kae_tab kae ON kae.idnkad_kae = kad.idnkad_kad
    JOIN ka9_tab ka9 ON ka9.idnkae_ka9 = kae.idnkae_kae
    WHERE LTRIM(RTRIM(kad.cinnum_kad)) = '${padded}'
  `);
  return r.recordset[0]?.idnkaj_ka9 || null;
}

async function applyKbrAction(
  pool: sql.ConnectionPool,
  kaj: number,
  parsed: ParsedEmail,
): Promise<{ action: string; alerted: boolean; alertMessage?: string }> {
  if (parsed.outcome === "unparseable" || !parsed.formType) {
    return { action: "no_action", alerted: false };
  }
  const kap = parsed.formType === "810" ? 24 : 25;
  const stateLabel = parsed.formType === "810" ? "WAWF 810 sent" : "WAWF 856 sent";

  if (parsed.outcome === "accepted" || parsed.outcome === "accepted_with_modifications" || parsed.outcome === "rejected_benign") {
    // Ensure kbr row exists; update with real WAWF TCN
    const existing = await pool.request().query(`
      SELECT idnkbr_kbr FROM kbr_tab WHERE itttbl_kbr='kaj' AND idnitt_kbr=${kaj} AND idnkap_kbr=${kap}
    `);
    if (existing.recordset.length === 0) {
      await pool.request().query(`
        INSERT INTO kbr_tab (addtme_kbr, addnme_kbr, itttbl_kbr, idnitt_kbr, idnkap_kbr, xtcscn_kbr, xtcsta_kbr, xtctme_kbr)
        VALUES (
          DATEADD(MILLISECOND, -DATEPART(MILLISECOND, GETDATE()), GETDATE()),
          'wawf-parser', 'kaj', ${kaj}, ${kap},
          '${parsed.wawfTcn || "1"}', '${stateLabel}',
          DATEADD(MILLISECOND, -DATEPART(MILLISECOND, GETDATE()), GETDATE())
        )
      `);
      return { action: "kbr_restored", alerted: false };
    } else if (parsed.wawfTcn) {
      await pool.request().query(`
        UPDATE kbr_tab SET xtcscn_kbr='${parsed.wawfTcn}'
        WHERE itttbl_kbr='kaj' AND idnitt_kbr=${kaj} AND idnkap_kbr=${kap}
      `);
      return { action: "tcn_updated", alerted: false };
    }
    return { action: "no_action", alerted: false };
  }

  if (parsed.outcome === "rejected") {
    // Real reject — DELETE the false kbr row + return alert message
    await pool.request().query(`
      DELETE FROM kbr_tab WHERE itttbl_kbr='kaj' AND idnitt_kbr=${kaj} AND idnkap_kbr=${kap}
    `);
    const msg = `🚨 WAWF ${parsed.formType} REJECTED — CIN ${parsed.cin} contract ${parsed.contractNo}\n${parsed.errorText?.slice(0, 200) || "(no error text)"}`;
    return { action: "alerted", alerted: true, alertMessage: msg };
  }

  return { action: "no_action", alerted: false };
}

async function sendWhatsAppAlert(message: string): Promise<void> {
  const url = process.env.DIBS_WHATSAPP_ALERT_URL || "https://dibs-gov-production.up.railway.app/api/whatsapp/send";
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": process.env.DIBS_INTERNAL_TOKEN || "" },
      body: JSON.stringify({ message, channel: "alerts" }),
    });
  } catch (e: any) {
    console.log(`  WhatsApp alert send error: ${e.message?.slice(0, 80)}`);
  }
}

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Decide lookback based on most recent log
  const { data: lastLog } = await sb
    .from("wawf_email_log")
    .select("received_at")
    .order("received_at", { ascending: false })
    .limit(1);
  const lookbackMin = lastLog?.[0]?.received_at
    ? Math.max(15, Math.ceil((Date.now() - new Date(lastLog[0].received_at).getTime()) / 60_000) + 5)
    : 24 * 60;

  console.log(`Fetching WAWF emails (last ${lookbackMin} min)...`);
  const emails = await fetchFromSender(WAWF_SENDER, lookbackMin, 200);
  console.log(`Found ${emails.length} candidate emails`);

  let processed = 0, skippedDup = 0, alerts = 0;

  for (const eml of emails) {
    // Dedup
    const { data: existing } = await sb
      .from("wawf_email_log")
      .select("id")
      .eq("ews_uid", eml.uid)
      .maybeSingle();
    if (existing) { skippedDup++; continue; }

    const parsed = parseEmailBody(eml.subject, eml.bodyText);

    let matchedKaj: number | null = null;
    let kbrAction = "no_action";
    let alerted = false;

    if (parsed.cin && parsed.formType) {
      matchedKaj = await findKajForCin(pool, parsed.cin);
      if (matchedKaj) {
        const result = await applyKbrAction(pool, matchedKaj, parsed);
        kbrAction = result.action;
        if (result.alerted && result.alertMessage) {
          await sendWhatsAppAlert(result.alertMessage);
          alerted = true;
          alerts++;
        }
      }
    }

    await sb.from("wawf_email_log").insert({
      ews_uid: eml.uid,
      received_at: eml.receivedAt.toISOString(),
      subject: eml.subject,
      form_type: parsed.formType,
      contract_no: parsed.contractNo,
      cin: parsed.cin,
      shipment_no: parsed.shipmentNo,
      wawf_tcn: parsed.wawfTcn,
      outcome: parsed.outcome,
      error_text: parsed.errorText,
      matched_kaj: matchedKaj,
      kbr_action: kbrAction,
      alerted,
      raw_body: eml.bodyText.slice(0, 8000),
    });
    processed++;

    console.log(`  ${eml.subject.slice(0, 50).padEnd(50)} → ${parsed.outcome} ${parsed.formType || ""} CIN=${parsed.cin || "?"} ${kbrAction}`);
  }

  console.log(`\nDone: processed=${processed}, dup=${skippedDup}, alerts=${alerts}`);
  await pool.close();
})().catch((e) => { console.error(e); process.exit(1); });
