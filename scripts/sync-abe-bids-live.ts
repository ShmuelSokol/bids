/**
 * Sync Abe's live bidding activity from LamLinks → Supabase.
 * Shows pending (unbatched) and submitted bids from today.
 *
 * Run locally every 5 min via Windows Task Scheduler:
 *   npx tsx scripts/sync-abe-bids-live.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Convert a Date that msnodesqlv8 returned for a naive LamLinks
 * DATETIME (server local = America/New_York) into proper UTC.
 *
 * The driver reads a value like `2026-04-15 15:27:58` and returns
 * `Date(2026-04-15T15:27:58.000Z)` — same wall-clock numbers tagged
 * UTC. We want UTC that represents 15:27 ET, which (in DST) is
 * 19:27 UTC. So we pull the wall-clock components out and rebuild a
 * Date in the ET zone using Intl.
 *
 * Handles DST correctly because we derive the offset from the
 * claimed wall-clock instant interpreted as NY time.
 */
function etNaiveToUtcIso(d: Date | null | undefined): string | null {
  if (!d || isNaN(d.getTime())) return null;
  // Pull wall-clock components from the "UTC-tagged" Date, which
  // are actually the ET wall-clock numbers.
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const da = d.getUTCDate();
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();

  // Use a formatter to figure out the UTC offset for that wall-clock
  // moment in America/New_York. It returns something like "GMT-04:00".
  const probe = new Date(Date.UTC(y, mo, da, h, mi, s, ms));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour12: false,
  }).formatToParts(probe);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-05:00";
  const m = tzPart.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = m?.[1] === "-" ? -1 : 1;
  const hrs = Number(m?.[2] || 0);
  const mins = Number(m?.[3] || 0);
  const offsetMs = sign * (hrs * 60 + mins) * 60 * 1000;

  // Wall-clock moment in ET → true UTC = wall-clock minus offset.
  // If ET is UTC-4, offsetMs = -14400000. Subtracting a negative =
  // adding 4 hours → correct UTC.
  const utc = probe.getTime() - offsetMs;
  return new Date(utc).toISOString();
}

async function main() {
  const pool = await sql.connect(config);

  // Get today's bids with full details. Timezone fix happens in TS
  // below — see etNaiveToUtcIso(). SQL Server 2012 on the LamLinks
  // box doesn't support AT TIME ZONE (2016+), so we can't fix it
  // server-side.
  const result = await pool.request().query(`
    SELECT
      k34.idnk34_k34 AS bid_id,
      k34.uptime_k34 AS bid_time,
      k34.upname_k34 AS bidder,
      k34.pn_k34 AS part_number,
      k34.mcage_k34 AS mfr_cage,
      k34.fobcod_k34 AS fob,
      k34.solqty_k34 AS sol_qty,
      k34.qty_ui_k34 AS uom,
      k35.up_k35 AS bid_price,
      k35.qty_k35 AS bid_qty,
      k35.daro_k35 AS lead_days,
      k10.sol_no_k10 AS solicitation_number,
      k10.closes_k10 AS due_date,
      k08.fsc_k08 AS fsc,
      k08.niin_k08 AS niin,
      k08.p_desc_k08 AS item_desc,
      k33.qotref_k33 AS batch_ref,
      k33.t_stat_k33 AS transmit_status,
      k33.a_stat_k33 AS ack_status,
      CASE
        WHEN k33.t_stat_k33 LIKE 'sent%' THEN 'submitted'
        WHEN k33.o_stat_k33 LIKE 'quotes added%' THEN 'pending'
        ELSE 'unknown'
      END AS bid_status
    FROM k34_tab k34
    JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    JOIN k11_tab k11 ON k11.idnk11_k11 = k34.idnk11_k34
    JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    LEFT JOIN k33_tab k33 ON k33.idnk33_k33 = k34.idnk33_k34
    WHERE k34.uptime_k34 >= CAST(GETDATE() AS DATE)
    ORDER BY k34.uptime_k34 DESC
  `);

  const bids = result.recordset.map((r: any) => ({
    bid_id: r.bid_id,
    bid_time: etNaiveToUtcIso(r.bid_time),
    bidder: r.bidder?.trim(),
    nsn: r.fsc && r.niin ? `${r.fsc.trim()}-${r.niin.trim()}` : null,
    fsc: r.fsc?.trim(),
    item_desc: r.item_desc?.trim(),
    part_number: r.part_number?.trim(),
    mfr_cage: r.mfr_cage?.trim(),
    solicitation_number: r.solicitation_number?.trim(),
    due_date: etNaiveToUtcIso(r.due_date),
    bid_price: r.bid_price,
    bid_qty: r.bid_qty,
    lead_days: r.lead_days,
    fob: r.fob?.trim(),
    bid_status: r.bid_status,
    batch_ref: r.batch_ref?.trim(),
    transmit_status: r.transmit_status?.trim(),
    synced_at: new Date().toISOString(),
  }));

  await pool.close();

  console.log(`${bids.length} bids today (${bids.filter(b => b.bid_status === 'submitted').length} submitted, ${bids.filter(b => b.bid_status === 'pending').length} pending)`);

  // Upsert to Supabase
  if (bids.length > 0) {
    for (let i = 0; i < bids.length; i += 100) {
      const batch = bids.slice(i, i + 100);
      await sb.from("abe_bids_live").upsert(batch, { onConflict: "bid_id" });
    }
  }

  // Log sync
  await sb.from("sync_log").insert({
    action: "abe_bids_live_sync",
    details: {
      total: bids.length,
      submitted: bids.filter(b => b.bid_status === "submitted").length,
      pending: bids.filter(b => b.bid_status === "pending").length,
    },
  });
}

main().catch(console.error);
