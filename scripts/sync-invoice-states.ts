/**
 * Snapshot LamLinks invoice (kad_tab) states and emit transition
 * events into Supabase. Tier 1 of the WAWF-visibility plan:
 * same-day signal for "Abe posted invoice X" without any external
 * integrations.
 *
 * How it works:
 *   - Query kad_tab for the last 30 days of rows
 *   - For each kad_id, find the most recent known state from
 *     invoice_state_events
 *   - If the row is new → emit 'appeared' event
 *   - If the state differs from last known → emit 'state_change'
 *   - No change → no event (the table only grows when reality changes)
 *
 * Typical event flow per invoice over its lifetime:
 *   appeared: Not Posted  (Abe created the invoice row in the LL UI)
 *   state_change: Not Posted → Posted   (Abe clicked Post)
 *   (Voided is rare but would show up as state_change: Posted → Voided)
 *
 * Run every 15 min via Windows Task Scheduler. Cheap — one SQL read,
 * a Supabase read of recent events, and tiny inserts only when
 * something changed.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
import { etNaiveToUtcIso } from "./tz-helpers";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type KadRow = {
  idnkad_kad: number;
  cinnum_kad: string | null;
  cinsta_kad: string | null;
  upname_kad: string | null;
  ar_val_kad: number | null;
  mslval_kad: number | null;
  uptime_kad: Date | null;
};

async function main() {
  const pool = await sql.connect(config);

  // Pull kad rows from the last 30 days. Older invoices rarely change
  // state, and keeping the window narrow means the O(N) diff is cheap.
  const result = await pool.request().query(`
    SELECT
      idnkad_kad, cinnum_kad, cinsta_kad, upname_kad,
      ar_val_kad, mslval_kad, uptime_kad
    FROM kad_tab
    WHERE uptime_kad >= DATEADD(day, -30, GETDATE())
    ORDER BY idnkad_kad DESC
  `);
  const kadRows: KadRow[] = result.recordset;
  await pool.close();

  console.log(`Pulled ${kadRows.length} kad rows (last 30d)`);

  if (kadRows.length === 0) return;

  // Load the most recent event per kad_id we've already seen.
  // Supabase caps .select() at 1000 rows by default even when an .in()
  // filter is present — so a chunk of 500 kad_ids with an avg of 2-3
  // events each would hit the cap and drop older-kad coverage
  // silently. Paginate by range() to get every event in the chunk.
  const kadIds = kadRows.map((r) => r.idnkad_kad);
  const lastSeen = new Map<number, string>();
  for (let i = 0; i < kadIds.length; i += 500) {
    const chunk = kadIds.slice(i, i + 500);
    for (let page = 0; page < 10; page++) {
      const { data, error } = await sb
        .from("invoice_state_events")
        .select("kad_id, to_state, detected_at")
        .in("kad_id", chunk)
        .order("detected_at", { ascending: false })
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (error) {
        console.error(`lookup page ${page} error: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const key = Number(row.kad_id); // normalize: PostgREST may give int or string
        if (!lastSeen.has(key)) {
          lastSeen.set(key, (row.to_state || "").trim());
        }
      }
      if (data.length < 1000) break;
    }
  }
  console.log(`  known state for ${lastSeen.size} / ${kadIds.length} kad_ids`);

  // Diff
  const newEvents: any[] = [];
  let appeared = 0;
  let changed = 0;
  for (const r of kadRows) {
    const state = (r.cinsta_kad || "").trim();
    if (!state) continue;
    const prev = lastSeen.get(Number(r.idnkad_kad));
    if (!prev) {
      newEvents.push({
        kad_id: r.idnkad_kad,
        invoice_number: r.cinnum_kad?.trim() || null,
        from_state: null,
        to_state: state,
        event_type: "appeared",
        upname: r.upname_kad?.trim() || null,
        total: r.ar_val_kad || r.mslval_kad || null,
        detected_at: etNaiveToUtcIso(r.uptime_kad) || new Date().toISOString(),
      });
      appeared++;
    } else if (prev !== state) {
      newEvents.push({
        kad_id: r.idnkad_kad,
        invoice_number: r.cinnum_kad?.trim() || null,
        from_state: prev,
        to_state: state,
        event_type: "state_change",
        upname: r.upname_kad?.trim() || null,
        total: r.ar_val_kad || r.mslval_kad || null,
        detected_at: new Date().toISOString(),
      });
      changed++;
    }
  }

  console.log(`New events: ${appeared} appeared, ${changed} state changes`);

  if (newEvents.length > 0) {
    for (let i = 0; i < newEvents.length; i += 200) {
      const batch = newEvents.slice(i, i + 200);
      const { error } = await sb.from("invoice_state_events").insert(batch);
      if (error) console.error(`Insert error at ${i}: ${error.message}`);
    }
  }

  // Log the sync for dashboard visibility
  await sb.from("sync_log").insert({
    action: "invoice_state_sync",
    details: {
      rows_pulled: kadRows.length,
      appeared,
      changed,
      total_events_written: newEvents.length,
    },
  });

  // Surface anything noteworthy — state changes to Posted or Voided
  // are the things Abe/Yosef care about
  const noteworthy = newEvents.filter(
    (e) => e.event_type === "state_change" &&
    (e.to_state === "Posted" || e.to_state === "Voided")
  );
  if (noteworthy.length > 0) {
    console.log(`\nNoteworthy transitions:`);
    for (const e of noteworthy) {
      console.log(`  kad=${e.kad_id} inv=${e.invoice_number}  ${e.from_state} → ${e.to_state}  $${e.total}  by ${e.upname}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
