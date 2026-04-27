/**
 * Sally REST worker — runs on NYEVRVTC001 (whitelisted at api.lamlinks.com).
 *
 * Polls lamlinks_rest_queue for pending rows, spawns LL's bundled curl with
 * digest auth, parses the XML response, and updates the row.
 *
 * Why curl-shell-out instead of Node fetch + Digest:
 *  - LL's own logs prove the curl recipe works against this server.
 *  - Node Digest implementations are subtly fragile; the empty `--data`
 *    401 we hit on 2026-04-27 is exactly the kind of edge case curl
 *    handles correctly out of the box.
 *  - LL's curl is already on the box at the path below.
 *
 * Deployment on NYEVRVTC001:
 *   1. Install Node 20 LTS (https://nodejs.org/en/download/prebuilt-installer).
 *   2. Clone repo or copy this script + package.json + tsx.
 *   3. `npm install` in the repo root. (No msnodesqlv8 — this worker
 *      doesn't talk to LL's SQL DB.)
 *   4. Create `.env` with LL_* + SUPABASE_* vars. Never commit.
 *   5. Run `npx tsx scripts/ll-rest-worker.ts`. Use NSSM or PM2 for
 *      service-mode persistence; `start /min` works for ad-hoc.
 *
 * See docs/architecture/sally-rest-worker.md.
 */
import "./env";
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const POLL_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;
const CURL_PATH = process.env.LL_CURL_PATH || "G:\\PROGRAMS\\LAMLINKS\\Control\\Lamlinkp\\LLPservr\\code\\curl.exe";
const SALLY_HOST = process.env.LL_API_HOSTNAME || "api.lamlinks.com";
const SALLY_URL = `http://${SALLY_HOST}/api/llsm/create`;

interface QueueRow {
  id: number;
  lis_function: string;
  e_code: string;
  req_data_xml: string;
  wait_seconds: number;
  state: string;
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LL_LOGIN = process.env.LL_SALLY_LOGIN;
const LL_API_KEY = process.env.LL_API_KEY;
const LL_API_SECRET = process.env.LL_API_SECRET;
const LL_E_CODE = process.env.LL_E_CODE || "0AG09";

if (!SB_URL || !SB_KEY) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
if (!LL_LOGIN || !LL_API_KEY || !LL_API_SECRET) {
  throw new Error("LL_SALLY_LOGIN, LL_API_KEY, LL_API_SECRET required (extract from \\\\NYEVRVTC001\\c$\\LamlinkP\\data\\log\\)");
}

const sb = createClient(SB_URL, SB_KEY);
const HOST = hostname();

const TMP_BASE = process.env.LL_REST_TMP || join(tmpdir(), "ll-rest-worker");
if (!existsSync(TMP_BASE)) mkdirSync(TMP_BASE, { recursive: true });
const COOKIE_JAR = join(TMP_BASE, "ll-cookie-jar.txt");

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildRequestXml(lisFunction: string, eCode: string, reqData: string): string {
  return (
    `<Request>` +
    `<lis_function>${escapeXml(lisFunction)}</lis_function>` +
    `<e_code>${escapeXml(eCode)}</e_code>` +
    `<req_data>${reqData}</req_data>` +
    `</Request>`
  );
}

function buildFormBody(lisFunction: string, eCode: string, reqData: string, waitSeconds: number): string {
  const xml = buildRequestXml(lisFunction, eCode, reqData);
  return `wait=${waitSeconds}&function=${encodeURIComponent(lisFunction)}&data=${encodeURIComponent(xml)}`;
}

interface CurlResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCurl(body: string, outPath: string): Promise<CurlResult> {
  return new Promise((resolve, reject) => {
    const args = [
      "--digest",
      "--data", body,
      "-u", `${LL_LOGIN}#${LL_API_KEY}:${LL_API_SECRET}`,
      "-c", COOKIE_JAR,
      SALLY_URL,
      "-o", outPath,
      "-s",
      "-w", "HTTP_STATUS:%{http_code}\\n",
    ];
    const proc = spawn(CURL_PATH, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString()));
    proc.stderr.on("data", (b) => (stderr += b.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? -1 }));
  });
}

function extractHttpStatus(stdout: string): number | null {
  const m = /HTTP_STATUS:(\d+)/.exec(stdout);
  return m ? parseInt(m[1], 10) : null;
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractCompletionCode(xml: string): number | null {
  const raw =
    extractTag(xml, "completion_code") ||
    extractTag(xml, "rspcod") ||
    extractTag(xml, "response_code");
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function claimNextPending(): Promise<QueueRow | null> {
  // Best-effort optimistic claim. Two workers on the same queue would race;
  // we only run one worker per host, but the .eq("state","pending") guard
  // means at worst a row is picked up twice (which we'd see as duplicate
  // result rows, not a successful double-call).
  const { data: pending, error: pendErr } = await sb
    .from("lamlinks_rest_queue")
    .select("id, lis_function, e_code, req_data_xml, wait_seconds, state")
    .eq("state", "pending")
    .order("enqueued_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendErr) throw new Error(`claimNext select failed: ${pendErr.message}`);
  if (!pending) return null;

  const { data: claimed, error: claimErr } = await sb
    .from("lamlinks_rest_queue")
    .update({ state: "running", started_at: new Date().toISOString(), worker_host: HOST })
    .eq("id", pending.id)
    .eq("state", "pending")
    .select("id, lis_function, e_code, req_data_xml, wait_seconds, state")
    .maybeSingle();
  if (claimErr) throw new Error(`claimNext update failed: ${claimErr.message}`);
  return (claimed as QueueRow) ?? null;
}

async function processRow(row: QueueRow): Promise<void> {
  const outPath = join(TMP_BASE, `resp-${row.id}.xml`);
  const body = buildFormBody(row.lis_function, row.e_code, row.req_data_xml, row.wait_seconds);

  let updates: Record<string, unknown>;

  try {
    const { stdout, stderr, exitCode } = await runCurl(body, outPath);
    const httpStatus = extractHttpStatus(stdout);
    const responseXml = existsSync(outPath) ? readFileSync(outPath, "utf-8") : "";
    const compCode = extractCompletionCode(responseXml);

    if (exitCode !== 0) {
      updates = {
        state: "error",
        completed_at: new Date().toISOString(),
        http_status: httpStatus,
        completion_code: compCode,
        response_xml: responseXml,
        error_message: `curl exit ${exitCode}: ${stderr.slice(0, 500)}`,
      };
    } else {
      updates = {
        state: "done",
        completed_at: new Date().toISOString(),
        http_status: httpStatus,
        completion_code: compCode,
        response_xml: responseXml,
        error_message: null,
      };
    }
  } catch (e) {
    updates = {
      state: "error",
      completed_at: new Date().toISOString(),
      error_message: `worker exception: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    try { if (existsSync(outPath)) unlinkSync(outPath); } catch { /* ignore */ }
  }

  const { error } = await sb.from("lamlinks_rest_queue").update(updates).eq("id", row.id);
  if (error) {
    console.error(`[${row.id}] failed to write result: ${error.message}`);
  } else {
    console.log(`[${row.id}] ${row.lis_function} -> state=${updates.state} http=${updates.http_status} compCode=${updates.completion_code}`);
  }
}

let lastHeartbeatAt = 0;

async function maybeHeartbeat(): Promise<void> {
  const now = Date.now();
  if (now - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) return;
  lastHeartbeatAt = now;
  const { error } = await sb.from("lamlinks_rest_queue").insert({
    lis_function: "are_you_listening",
    e_code: LL_E_CODE,
    req_data_xml: "",
    wait_seconds: 15,
    enqueued_by: `worker:${HOST}`,
    related_kind: "heartbeat",
  });
  if (error) console.error(`heartbeat enqueue failed: ${error.message}`);
}

async function main() {
  console.log(`ll-rest-worker starting on ${HOST}, polling every ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`  curl:    ${CURL_PATH}`);
  console.log(`  sally:   ${SALLY_URL}`);
  console.log(`  cookie:  ${COOKIE_JAR}`);
  console.log(`  tmp:     ${TMP_BASE}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await maybeHeartbeat();
      const row = await claimNextPending();
      if (row) {
        await processRow(row);
        continue; // loop again immediately to drain backlog
      }
    } catch (e) {
      console.error(`loop error: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
