/**
 * Pretty-print the SQL Agent jobs we dumped from msdb. Now that we know
 * LL has no procs/triggers, these 31 jobs are literally the entire
 * server-side runtime — EDI transmit, ack processor, cleanup, etc.
 *
 *   npx tsx scripts/ll-list-agent-jobs.ts
 *   npx tsx scripts/ll-list-agent-jobs.ts --verbose     (include step commands)
 *   npx tsx scripts/ll-list-agent-jobs.ts --grep k33    (only jobs whose name or
 *                                                         step command matches)
 */
import "./env";
import { readFileSync } from "fs";
import { join } from "path";

function fmtFreq(s: any): string {
  // Decode sys.sysschedules freq_type (1=once, 4=daily, 8=weekly, 16=monthly,
  // 32=monthly-relative, 64=start/stop with SQL Server, 128=running).
  const types: Record<number, string> = {
    1: "once",
    4: "daily",
    8: "weekly",
    16: "monthly",
    32: "monthly-relative",
    64: "startup",
    128: "idle",
  };
  const base = types[s.freq_type] || `type=${s.freq_type}`;
  // Subday: freq_subday_type 1=at specified time, 2=seconds, 4=minutes, 8=hours
  const sub: Record<number, string> = { 1: "at time", 2: "sec", 4: "min", 8: "hr" };
  let out = base;
  if (s.freq_subday_type && s.freq_subday_type !== 1) {
    out += ` every ${s.freq_subday_interval} ${sub[s.freq_subday_type] || "?"}`;
  }
  if (s.freq_interval && base === "daily") out += ` (every ${s.freq_interval} day)`;
  if (s.active_start_time != null) {
    const t = String(s.active_start_time).padStart(6, "0");
    out += ` from ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
  }
  return out;
}

function main() {
  const verbose = process.argv.includes("--verbose");
  const gIdx = process.argv.indexOf("--grep");
  const grep = gIdx >= 0 ? process.argv[gIdx + 1]?.toLowerCase() : null;

  const path = join(process.cwd(), "docs", "lamlinks-schema", "agent-jobs.json");
  const jobs = JSON.parse(readFileSync(path, "utf-8")) as any[];

  let shown = 0;
  for (const j of jobs) {
    const nm = (j.job_name || "").toLowerCase();
    const stepsText = (j.steps || []).map((s: any) => s.command || "").join(" ").toLowerCase();
    if (grep && !nm.includes(grep) && !stepsText.includes(grep)) continue;

    shown++;
    const enabled = j.enabled === 1 ? "✓" : "✗";
    console.log(`\n${enabled}  [${j.job_name}]`);
    if (j.description && j.description !== "No description available.") {
      console.log(`   desc:     ${j.description.slice(0, 140)}`);
    }

    const sc = j.schedules || [];
    if (sc.length === 0) console.log(`   schedule: (none)`);
    else for (const s of sc) console.log(`   schedule: ${fmtFreq(s)} (${s.schedule_name})`);

    for (const step of j.steps || []) {
      const oneLine = (step.command || "").split("\n")[0].slice(0, 120);
      console.log(`   step ${step.step_id}:  [${step.subsystem}] ${step.step_name} — ${oneLine}${(step.command || "").includes("\n") ? " …" : ""}`);
      if (verbose) {
        const cmd = (step.command || "").split("\n").map((l: string) => "     " + l).join("\n");
        console.log(cmd);
      }
    }
  }

  console.log(`\n${shown} / ${jobs.length} jobs${grep ? ` matching "${grep}"` : ""}.`);
  if (!grep) console.log(`Filter with --grep <term>  (e.g. --grep k33, --grep edi, --grep transmit)`);
  if (!verbose) console.log(`Add --verbose to see full step commands.`);
}

main();
