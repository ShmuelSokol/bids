// Tail the invoice chain (kad, ka9, kae, ka8, kaj) in real time so we can
// watch what the LamLinks client does when Yosef clicks Post on one invoice.
//
// Usage:
//   npx tsx scripts/tail-invoice-chain.ts                 # tail new rows + changes from now forward
//   npx tsx scripts/tail-invoice-chain.ts --since-min=10  # also show changes in the last 10 min first
//
// What it prints:
//   - Any NEW rows in kad, ka9, kae (never ka8/kaj — those are created earlier)
//   - Any UPDATE on kad (status flips, link writes), ka9 (idnkae_ka9 links, status), kae (rare)
//   - Diff vs last snapshot so you see exactly what changed

import "./env";
import sql from "mssql/msnodesqlv8";

const POLL_MS = 1_000;

type RowSnap = Record<string, any>;

function diff(before: RowSnap, after: RowSnap): string[] {
  const changes: string[] = [];
  for (const k of Object.keys(after)) {
    const b = before[k];
    const a = after[k];
    const bs = b instanceof Date ? b.toISOString() : String(b ?? "");
    const as_ = a instanceof Date ? a.toISOString() : String(a ?? "");
    if (bs !== as_) changes.push(`${k}: "${bs.trim()}" → "${as_.trim()}"`);
  }
  return changes;
}

async function main() {
  const sinceArg = process.argv.find((a) => a.startsWith("--since-min="));
  const sinceMin = sinceArg ? Number(sinceArg.split("=")[1]) : 0;

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const startTime = new Date();
  const snapTime = new Date(Date.now() - sinceMin * 60_000);
  console.log(`${new Date().toISOString()} — tailing invoice chain (poll every ${POLL_MS}ms)`);
  console.log(`  snap baseline: ${snapTime.toISOString()}${sinceMin ? ` (${sinceMin} min lookback)` : " (now)"}`);
  console.log(`  press Ctrl-C to stop\n`);

  // Initial snapshot of recent rows per table (for update detection)
  const snapshots = new Map<string, Map<number, RowSnap>>();
  for (const t of ["kad_tab", "ka9_tab", "kae_tab"]) {
    snapshots.set(t, new Map());
  }

  async function captureSnapshot() {
    for (const [t, map] of snapshots) {
      const pk = `idn${t.slice(0, 3)}_${t.slice(0, 3)}`;
      const timeCol = t === "kad_tab" ? "uptime_kad" : t === "ka9_tab" ? "uptime_ka9" : "uptime_kae";
      try {
        const r = await pool.request().query(`
          SELECT * FROM ${t}
          WHERE ${timeCol} >= '${snapTime.toISOString()}'
        `);
        for (const row of r.recordset as any[]) {
          map.set(row[pk], row);
        }
      } catch (e: any) {
        // Some columns may not have uptime — fall back to a narrower query
        console.log(`  warn: ${t} initial snapshot: ${e.message.slice(0, 60)}`);
      }
    }
    console.log(`  initial snapshot: kad=${snapshots.get("kad_tab")?.size}, ka9=${snapshots.get("ka9_tab")?.size}, kae=${snapshots.get("kae_tab")?.size} rows tracked\n`);
  }

  await captureSnapshot();

  let lastPoll = new Date();
  let tick = 0;
  while (true) {
    tick++;
    const now = new Date();

    for (const [t, map] of snapshots) {
      const pk = `idn${t.slice(0, 3)}_${t.slice(0, 3)}`;
      const timeCol = t === "kad_tab" ? "uptime_kad" : t === "ka9_tab" ? "uptime_ka9" : "uptime_kae";
      try {
        const r = await pool.request().query(`
          SELECT * FROM ${t}
          WHERE ${timeCol} > '${lastPoll.toISOString()}'
        `);
        for (const row of r.recordset as any[]) {
          const id = row[pk];
          const prev = map.get(id);
          if (!prev) {
            // New row
            const keyFields = Object.entries(row)
              .filter(([k, v]) => v !== null && v !== 0 && v !== "")
              .slice(0, 10)
              .map(([k, v]) => `${k}=${typeof v === "string" ? (v as string).trim().slice(0, 30) : v instanceof Date ? v.toISOString().slice(11, 19) : v}`)
              .join(" | ");
            console.log(`${now.toISOString().slice(11, 19)}  [NEW ${t.replace("_tab", "")} #${id}]  ${keyFields}`);
            map.set(id, row);
          } else {
            // Possible update
            const changes = diff(prev, row);
            // Ignore uptime-only changes that are just a refresh
            const meaningful = changes.filter((c) => !c.startsWith("uptime_"));
            if (meaningful.length > 0) {
              console.log(`${now.toISOString().slice(11, 19)}  [UPDATE ${t.replace("_tab", "")} #${id}]`);
              for (const c of changes) console.log(`    ${c}`);
            }
            map.set(id, row);
          }
        }
      } catch (e: any) {
        if (tick % 30 === 0) console.log(`  ${t} poll error: ${e.message.slice(0, 80)}`);
      }
    }

    lastPoll = now;
    if (tick % 60 === 0) {
      console.log(`${now.toISOString().slice(11, 19)}  (heartbeat, ${tick} polls, ${Math.floor((now.getTime() - startTime.getTime()) / 60_000)} min)`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
