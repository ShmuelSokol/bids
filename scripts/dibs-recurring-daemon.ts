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
  { script: "sync-invoice-states", mode: "periodic", intervalMs: 5 * 60_000 },

  // Worker-health alert — every 5 min, checks heartbeat + queue depth and
  // fires a WhatsApp alert if either goes bad during work hours. Debounced
  // to 30 min to avoid spam.
  { script: "check-worker-health-alert", mode: "periodic", intervalMs: 5 * 60_000, skipInitialRun: true },
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
