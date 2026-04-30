// DIBS recurring daemon — ONE persistent process that runs every recurring
// sync on its own cadence. Replaces the previous pattern of five separate
// Windows scheduled tasks that popped minimized cmd windows every 5-15 min.
//
// Launches at logon via Windows Task Scheduler (see scripts/windows/install-tasks.bat).
// Stays running as long as the user is signed in. Re-login to restart if it dies.
//
// Two task modes:
//   - "periodic": spawn the script at a fixed interval; skip the tick if the
//     previous subprocess is still running (avoid overlap).
//   - "persistent": keep one child running continuously; if it exits, wait
//     backoffMs and respawn.
//
// Logs: each task's stdout/stderr appends to C:\tmp\dibs-logs\<script>.log
// (matches the old per-task log location, so operators don't need to relearn).

import "./env";
import { spawn, ChildProcess } from "child_process";
import { createWriteStream, mkdirSync } from "fs";
import * as path from "path";

type Task = {
  script: string;
  args?: string[];
  mode: "periodic" | "persistent";
  intervalMs?: number;   // required for periodic
  backoffMs?: number;    // how long to wait before respawning a dead persistent child (default 60s)
  skipInitialRun?: boolean; // if true, wait intervalMs before first fire instead of firing immediately
};

// Intervals chosen for near-real-time feel now that there's no popup cost.
// All spawns use windowsHide:true so every sync runs invisibly. Daemon's
// "skip tick if previous still running" logic prevents overlap if any
// individual sync runs longer than its interval.
const TASKS: Task[] = [
  // Real-time writeback worker — drains lamlinks_write_queue every 30s.
  // Persistent because spawning a fresh node.exe every 30s is wasteful;
  // the script's internal --loop handles its own polling.
  { script: "lamlinks-writeback-worker", args: ["--loop"], mode: "persistent" },

  // Abe's live bids sync — every 2 min, 24/7. Keeps the DIBS dashboard's
  // "Abe Bids Today" panel near-real-time even at 10 PM or on weekends.
  { script: "sync-abe-bids-live", mode: "periodic", intervalMs: 2 * 60_000 },

  // Status reconciler — flips DIBS bid_decisions.status quoted→submitted once
  // LamLinks has transmitted the bid (k33.t_stat_k33='sent'). 2 min so the
  // UI feels instant after Abe clicks Post in LamLinks.
  { script: "sync-dibs-status", args: ["--execute"], mode: "periodic", intervalMs: 2 * 60_000, skipInitialRun: true },

  // AX PO poll — advances purchase_orders.dmf_state as headers + lines land
  // in AX. Every 3 min (AX is the slowest of the integrations). No-op when
  // no PO is in an in-flight state.
  { script: "poll-ax-pos", mode: "periodic", intervalMs: 3 * 60_000 },

  // Shipping updates — warehouse writes tracking numbers throughout the day.
  { script: "sync-shipping", mode: "periodic", intervalMs: 5 * 60_000 },

  // Invoice state monitor — watches LamLinks kad_tab.cinsta_kad for transitions
  // so /invoicing/monitor surfaces "Abe posted invoice X" near-real-time.
  // 30s cadence: Abe's manual LL posts surface in DIBS within ~30 sec average.
  // (Tradeoff: slight extra LL SQL polling load, negligible in absolute terms.)
  { script: "sync-invoice-states", mode: "periodic", intervalMs: 30_000 },

  // Worker-health alert — every 5 min, checks heartbeat + queue depth and
  // fires a WhatsApp alert if either goes bad during work hours. Debounced
  // to 30 min to avoid spam.
  { script: "check-worker-health-alert", mode: "periodic", intervalMs: 5 * 60_000, skipInitialRun: true },

  // Sally-down alert — polls sftp.lamlinks.com:/incoming/ for our .laz
  // files older than 30 min. If found → Sally is backlogged or down on
  // LL's side, fire WhatsApp alert + log to sync_log. Debounced 60 min.
  // Discovered need 2026-04-30 when Sally went silent for 4+ hours and
  // we sat unaware while files piled up.
  { script: "check-sally-stuck-files", mode: "periodic", intervalMs: 10 * 60_000, skipInitialRun: true },

  // LL EDI transmissions — kbr_tab → ll_edi_transmissions. Abe ships many
  // times a day; the /shipping page's WAWF pills + stale-810 alerts only
  // refresh as fast as this sync. 5 min keeps them near-real-time. 14-day
  // window is enough to catch status changes on any recent transmission.
  { script: "sync-ll-edi-transmissions", args: ["--days", "14"], mode: "periodic", intervalMs: 5 * 60_000, skipInitialRun: true },

  // LL POD records — k89_tab → ll_pod_records. Currently empty for ERG
  // (no non-DLA customer-PO flow) but kept in the rotation so we catch
  // the day that changes. Cheap query, 30 min is fine.
  { script: "sync-ll-pod-records", args: ["--days", "30"], mode: "periodic", intervalMs: 30 * 60_000, skipInitialRun: true },

  // LL item PIDs — kah_tab → ll_item_pids. Per-NSN Procurement Item
  // Description + Packaging Requirements. Expensive query (scans 170K
  // kah rows). Runs every 4 hours with a 1-year window — captures new
  // awards' PIDs without hammering LL SQL. Full 3-year backfill is a
  // manual `npx tsx scripts/sync-ll-item-pids.ts --years 3` run.
  { script: "sync-ll-item-pids", args: ["--years", "1"], mode: "periodic", intervalMs: 4 * 60 * 60_000, skipInitialRun: true },

  // LL inventory on hand — k93_tab aggregation into ll_inventory_on_hand.
  // Keeps the /inventory page fresh. Query is fast (~1s for 25K NSN rollup)
  // but receipts/reservations update throughout the day. 30-min cadence.
  { script: "sync-ll-inventory-on-hand", mode: "periodic", intervalMs: 30 * 60_000, skipInitialRun: true },

  // LL kaj-level shipments — one row per shipment header with aggregated
  // CLIN count + total qty + total value + representative NSN. Used by
  // the ack tracker to resolve idnkaj → shipment detail. 180-day window
  // so every kbr_tab row can join to its shipment.
  { script: "sync-ll-shipments-by-kaj", args: ["--days", "180"], mode: "periodic", intervalMs: 30 * 60_000, skipInitialRun: true },

  // AX DLA payment sync — Phase 2 of the ack tracker. Pulls DLA's
  // CustTransactions (invoices + settlements) so we can cross-reference
  // aging 810s with what's actually been paid. Hourly is fine; nothing
  // changes within hours.
  { script: "sync-ax-dla-payments", args: ["--days", "365"], mode: "periodic", intervalMs: 60 * 60_000, skipInitialRun: true },

  // NSN auto-research worker + daily enqueue are INTENTIONALLY NOT in the
  // daemon right now — team is reviewing initial results before we let it
  // run on future DIBBS batches unattended. To re-enable:
  //   1. Add the two task entries back here
  //   2. Restart the daemon
  // Meanwhile, run manually as needed:
  //   npx tsx scripts/research-worker.ts --loop
  //   npx tsx scripts/enqueue-research.ts --days 2

  // Pipeline snapshot — queries llk_db1 for stuck / unshipped / recent
  // envelopes and writes into ll_pipeline_snapshots. Powers /ops/dibs-pipeline.
  // 5 min is a comfortable cadence; the UI shows latest snapshot + age.
  { script: "snapshot-ll-pipeline", mode: "periodic", intervalMs: 5 * 60_000, skipInitialRun: false },

  // DD219 DODAAC sync — mirrors AX CustomerPostalAddresses (DD219) into
  // Supabase dodaac_map so the /so validation flow has every gov ship-to
  // without Abe maintaining the mapping in two places. Daily is plenty —
  // new DODAACs are added once or twice a week at most.
  { script: "sync-dodaac-from-ax", args: ["--apply"], mode: "periodic", intervalMs: 24 * 60 * 60_000, skipInitialRun: true },

  // WAWF-vs-kbr reconciliation — pulls last 7 days of DD219 invoices from
  // AX and cross-checks each against LL kad/kaj/kbr state. Flags missing-kad
  // and 'WAWF X upfail' rows so we catch silent SFTP failures the morning
  // after they happen (CIN0066268 pattern from 2026-04-29). Daily cadence;
  // logs to sync_log. Doesn't (yet) verify WAWF acks — that's pending the
  // inbox integration. See reconcile-wawf-vs-kbr.ts docstring for scope.
  { script: "reconcile-wawf-vs-kbr", args: ["--days", "7"], mode: "periodic", intervalMs: 24 * 60 * 60_000, skipInitialRun: true },

  // AX vendors → dibs_suppliers — mirrors AX-known vendor emails into the
  // suppliers registry that drives the RFQ outbound flow. AX has ~5,597
  // vendors total; ~217 have a non-empty PrimaryEmailAddress today. Daily
  // sync — Abe (or someone) adds new vendor emails in AX a few per week.
  // Manual edits in DIBS (notes, blocked, last_verified) are preserved
  // since we only upsert AX-sourced fields.
  { script: "sync-suppliers-from-ax", args: ["--apply"], mode: "periodic", intervalMs: 24 * 60 * 60_000, skipInitialRun: true },

  // WAWF email auto-parse — reads Abe's inbox via EWS for WAWF noreply
  // emails, parses each (810/856 accept/reject), updates kbr.xtcscn with
  // the real WAWF TCN on accept, deletes false kbr + WhatsApp alerts on
  // real reject (UoM/dup/contract), restores kbr on benign "no Acceptor"
  // rejects. Persists every parsed email to wawf_email_log table.
  // 10-min cadence — fast enough for Abe to see status changes near-real-
  // time, slow enough not to hammer Exchange. Daemon-side ONLY (Railway
  // can't reach mail.everreadygroup.com).
  { script: "parse-wawf-emails", mode: "periodic", intervalMs: 10 * 60_000, skipInitialRun: true },

  // WAWF 810 ack digest — computes inferred ack status per transmission.
  // Once daily at morning roll-up time. --alert --min 5 fires a WhatsApp
  // to Yosef if 5+ invoices cross the 30-day staleness line without
  // payment. Every interval runs regardless, logs to console + sync_log;
  // alert only fires at the threshold.
  { script: "ack-tracker-digest", args: ["--alert", "--min", "5"], mode: "periodic", intervalMs: 24 * 60 * 60_000, skipInitialRun: true },
];

const LOG_DIR = "C:\\tmp\\dibs-logs";
const DIBS_DIR = "C:\\tmp\\dibs-init\\dibs";

mkdirSync(LOG_DIR, { recursive: true });

function openLog(script: string) {
  const p = path.join(LOG_DIR, `${script}.log`);
  return createWriteStream(p, { flags: "a" });
}

function tag() {
  return `[${new Date().toISOString()}]`;
}

function spawnTask(task: Task): ChildProcess {
  const logStream = openLog(task.script);
  const label = task.mode === "persistent" ? `${task.script} (persistent)` : task.script;
  logStream.write(`\n=== ${tag()} starting ${label} ${(task.args || []).join(" ")} ===\n`);

  const proc = spawn("cmd.exe", [
    "/c",
    "npx", "tsx", `scripts\\${task.script}.ts`,
    ...(task.args || []),
  ], {
    cwd: DIBS_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true, // hide any subprocess window — this is the key to "no popups"
  });

  proc.stdout?.pipe(logStream, { end: false });
  proc.stderr?.pipe(logStream, { end: false });
  proc.on("exit", (code) => {
    logStream.write(`=== ${tag()} ${label} exited (code ${code}) ===\n`);
    logStream.end();
  });

  return proc;
}

async function runPeriodic(task: Task) {
  const intervalMs = task.intervalMs!;
  let running: ChildProcess | null = null;

  const tick = () => {
    if (running) {
      // Previous instance still alive — skip this tick. Happens if a sync runs long.
      const log = openLog(task.script);
      log.write(`${tag()} skipping tick (previous instance still running)\n`);
      log.end();
      return;
    }
    running = spawnTask(task);
    running.on("exit", () => { running = null; });
  };

  if (!task.skipInitialRun) tick();
  setInterval(tick, intervalMs);
  console.log(`${tag()} scheduled ${task.script} every ${intervalMs / 1000}s`);
}

async function runPersistent(task: Task) {
  const backoff = task.backoffMs ?? 60_000;
  let attempts = 0;

  const loop = () => {
    attempts++;
    const proc = spawnTask(task);
    proc.on("exit", (code) => {
      const log = openLog(task.script);
      log.write(`${tag()} persistent exited code=${code}, restart in ${backoff / 1000}s (attempt ${attempts})\n`);
      log.end();
      setTimeout(loop, backoff);
    });
  };

  loop();
  console.log(`${tag()} launched persistent ${task.script}, backoffMs=${backoff}`);
}

async function main() {
  console.log(`${tag()} DIBS recurring daemon starting.`);
  console.log(`${tag()} PID ${process.pid}. Logs: ${LOG_DIR}\\<script>.log`);
  console.log(`${tag()} ${TASKS.length} tasks scheduled:`);
  for (const t of TASKS) {
    console.log(`  - ${t.script} [${t.mode}${t.intervalMs ? ` ${t.intervalMs / 1000}s` : ""}]${t.args ? ` args=${t.args.join(" ")}` : ""}`);
  }

  for (const task of TASKS) {
    if (task.mode === "periodic") runPeriodic(task);
    else runPersistent(task);
    // Small stagger so a bunch of child nodes don't start simultaneously
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Keep the process alive indefinitely. setInterval callbacks keep the event
  // loop awake. Also set a heartbeat for clarity in the parent log.
  setInterval(() => {
    // console.log(`${tag()} heartbeat`);
  }, 5 * 60_000);

  process.on("SIGINT", () => { console.log(`${tag()} SIGINT, exiting.`); process.exit(0); });
  process.on("SIGTERM", () => { console.log(`${tag()} SIGTERM, exiting.`); process.exit(0); });
}

main().catch((e) => {
  console.error(`${tag()} daemon crashed:`, e);
  process.exit(1);
});
