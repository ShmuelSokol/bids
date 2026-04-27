/**
 * LamLinks REST API client — the "Sally" / LLSM surface at api.lamlinks.com.
 *
 * Reverse-engineered from llprun.exe strings; see docs/lamlinks-reverse-engineering.md
 * and docs/lamlinks-feature-inventory.md for the full background.
 *
 * Endpoint: http://api.lamlinks.com/api/llsm/create
 * Auth:     HTTP Digest, realm="API_TEST"
 *           username = "<sally_login>#<api_key>"   (literal '#' separator)
 *           password = <api_secret>
 * Body:     application/x-www-form-urlencoded
 *           wait=<timeout_seconds>&function=<name>&data=<URL-encoded XML>
 *
 * Credentials:
 * - sally_login — user email (e.g. "ajoseph@everreadygroup.com"), stored in
 *   kah_tab with anutyp_kah='Sally Credentials' joined to k14_tab. Also
 *   equals the LL desktop password for that user.
 * - api_key — 27-char string, prefix "7Lx" for LamLinks Clients. Stored
 *   per-workstation in C:\LamlinkP\LLPro.ini (or related secure file).
 *   NOT in llk_db1.
 * - api_secret — randomly-generated companion. Same storage as api_key.
 *
 * Until api_key + api_secret are surfaced from a workstation, this client
 * will throw on any call. Once ERG's credentials are in .env, everything
 * works.
 */

import { createHash, randomBytes } from "node:crypto";

export interface LamLinksRestCredentials {
  sallyLogin: string;   // e.g. "ajoseph@everreadygroup.com"
  apiKey: string;       // 27-char, prefix "7Lx" for clients
  apiSecret: string;
  eCode: string;        // ERG's corp e_code = "0AG09"
  hostname?: string;    // default "api.lamlinks.com"
}

export interface LamLinksRestResponse {
  compCode: number;
  message: string;
  dataXml: string | null;
  rawResponse: string;
  httpStatus: number;
}

const DEFAULT_HOSTNAME = "api.lamlinks.com";
const API_PATH = "/api/llsm/create";

/**
 * Build the <Request> envelope for a LIS function call.
 * The schema is consistent across all ~40 functions.
 */
export function buildRequestXml(lisFunction: string, eCode: string, reqData: string): string {
  return (
    `<Request>` +
    `<lis_function>${escapeXml(lisFunction)}</lis_function>` +
    `<e_code>${escapeXml(eCode)}</e_code>` +
    `<req_data>${reqData}</req_data>` +
    `</Request>`
  );
}

/**
 * Call a LIS function. Returns parsed response envelope.
 *
 * Functions documented from llprun.exe strings:
 * - are_you_listening (heartbeat, takes e_code only)
 * - e_code_to_entity_info
 * - sol_no_to_quote_info
 * - sol_no_to_tdps
 * - get_awards_by_contract_url
 * - put_client_quote (takes full quote XML in req_data)
 * - ...and more — see docs/lamlinks-feature-inventory.md
 */
export async function callLisFunction(
  creds: LamLinksRestCredentials,
  lisFunction: string,
  reqData: string = "",
  waitSeconds: number = 30
): Promise<LamLinksRestResponse> {
  const hostname = creds.hostname ?? DEFAULT_HOSTNAME;
  const requestXml = buildRequestXml(lisFunction, creds.eCode, reqData);

  const body =
    `&wait=${waitSeconds}` +
    `&function=${encodeURIComponent(lisFunction)}` +
    `&data=${encodeURIComponent(requestXml)}`;

  const url = `http://${hostname}${API_PATH}`;

  // Step 1: GET a 401 to learn the nonce
  const challenge = await fetchChallenge(url);

  // Step 2: compute Digest response and POST
  const authHeader = buildDigestHeader({
    username: `${creds.sallyLogin}#${creds.apiKey}`,
    password: creds.apiSecret,
    method: "POST",
    uri: API_PATH,
    realm: challenge.realm,
    nonce: challenge.nonce,
    opaque: challenge.opaque,
    qop: challenge.qop ?? "auth",
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "DIBS/1.0",
    },
    body,
  });
  const text = await resp.text();

  return {
    compCode: extractCompCode(text),
    message: extractXmlTag(text, "rspmsg") ?? "",
    dataXml: extractXmlTag(text, "response_data"),
    rawResponse: text,
    httpStatus: resp.status,
  };
}

// -- HTTP Digest auth helpers (Node doesn't ship one) --

interface DigestChallenge {
  realm: string;
  nonce: string;
  opaque?: string;
  qop?: string;
}

async function fetchChallenge(url: string): Promise<DigestChallenge> {
  const resp = await fetch(url, { method: "POST", body: "" });
  const authHeader = resp.headers.get("www-authenticate");
  if (!authHeader || !authHeader.toLowerCase().startsWith("digest ")) {
    throw new Error(`Expected Digest challenge, got: ${authHeader ?? "(no header)"} (status ${resp.status})`);
  }
  return parseDigestHeader(authHeader.substring(7));
}

function parseDigestHeader(raw: string): DigestChallenge {
  const out: Record<string, string> = {};
  // naive parser: handles realm="x", nonce="y" comma-separated pairs
  const re = /(\w+)="?([^",]+)"?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out[m[1].toLowerCase()] = m[2];
  }
  if (!out.realm || !out.nonce) {
    throw new Error(`Malformed Digest challenge: ${raw}`);
  }
  return { realm: out.realm, nonce: out.nonce, opaque: out.opaque, qop: out.qop };
}

interface DigestInputs {
  username: string;
  password: string;
  method: string;
  uri: string;
  realm: string;
  nonce: string;
  opaque?: string;
  qop: string;
}

function buildDigestHeader(i: DigestInputs): string {
  const cnonce = randomBytes(16).toString("hex");
  const nc = "00000001";
  const ha1 = md5(`${i.username}:${i.realm}:${i.password}`);
  const ha2 = md5(`${i.method}:${i.uri}`);
  const response = md5(`${ha1}:${i.nonce}:${nc}:${cnonce}:${i.qop}:${ha2}`);
  const parts = [
    `username="${i.username}"`,
    `realm="${i.realm}"`,
    `nonce="${i.nonce}"`,
    `uri="${i.uri}"`,
    `qop=${i.qop}`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `response="${response}"`,
  ];
  if (i.opaque) parts.push(`opaque="${i.opaque}"`);
  return `Digest ${parts.join(", ")}`;
}

function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

// -- XML helpers (tiny, no dep) --

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function extractCompCode(xml: string): number {
  const raw = extractXmlTag(xml, "rspcod") ?? extractXmlTag(xml, "comp_code") ?? "";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : -1;
}

/**
 * Load credentials from env — convenient for API routes and scripts.
 * Required env vars (set in .env, NEVER commit):
 *   LL_SALLY_LOGIN=ajoseph@everreadygroup.com
 *   LL_API_KEY=7Lx...   (27 chars, from LLPro.ini on a workstation)
 *   LL_API_SECRET=...
 *   LL_E_CODE=0AG09
 *   LL_API_HOSTNAME=api.lamlinks.com   (optional)
 */
export function credentialsFromEnv(): LamLinksRestCredentials {
  const sallyLogin = process.env.LL_SALLY_LOGIN;
  const apiKey = process.env.LL_API_KEY;
  const apiSecret = process.env.LL_API_SECRET;
  const eCode = process.env.LL_E_CODE ?? "0AG09";
  const hostname = process.env.LL_API_HOSTNAME;
  if (!sallyLogin || !apiKey || !apiSecret) {
    throw new Error(
      "LamLinks REST credentials missing. Set LL_SALLY_LOGIN, LL_API_KEY, LL_API_SECRET in .env. " +
        "api_key/api_secret are in C:\\LamlinkP\\LLPro.ini on an LL workstation."
    );
  }
  return { sallyLogin, apiKey, apiSecret, eCode, hostname };
}

/**
 * Pull sally_login + sally_password fresh from kah_tab — same query LL's
 * native client fires at the start of every Post (confirmed via 2026-04-27
 * XE trace). Auto-rotates if anyone changes the user's password without
 * needing an .env update.
 *
 * Caller must still provide api_key + api_secret separately (they live in
 * LLPro.ini on disk, not in the DB). This helper is useful when those two
 * are sourced from .env but you want fresh sally_login on every call.
 *
 * Requires msnodesqlv8 + Windows Auth on a host with reach to NYEVRVSQL001.
 * Won't run on Railway. Use this in worker context only.
 */
export async function credentialsFromKahTab(
  idnk14: number,
  apiKey: string,
  apiSecret: string,
  eCode: string = "0AG09",
): Promise<LamLinksRestCredentials> {
  // Lazy import so Railway-side code that imports lamlinks-rest doesn't blow up
  // on the missing native msnodesqlv8 module. Use require() to dodge the
  // type-resolution warning since msnodesqlv8 ships no .d.ts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sql: any = require("mssql/msnodesqlv8");
  const pool = await (sql.default || sql).connect({
    connectionString:
      "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  try {
    const r = await pool.request().query(`
      SELECT a_note_kah
      FROM dbo.kah_tab
      WHERE anutyp_kah LIKE 'Sally Credentials'
        AND anutbl_kah LIKE 'k14'
        AND idnanu_kah = ${Number(idnk14)}
    `);
    if (r.recordset.length === 0) throw new Error(`No Sally Credentials row for idnk14=${idnk14}`);
    const xml = String(r.recordset[0].a_note_kah || "");
    const sallyLogin =
      (/<sally_login>([^<]*)<\/sally_login>/i.exec(xml) || [])[1] ?? "";
    if (!sallyLogin) throw new Error(`kah_tab row for idnk14=${idnk14} missing <sally_login>`);
    return { sallyLogin, apiKey, apiSecret, eCode };
  } finally {
    await pool.close();
  }
}
