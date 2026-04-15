/**
 * Reverse-engineer the AX purchase-order write path by analyzing the
 * 50 most recent POs. Same pattern as reverse-engineer-bid-schema.ts
 * and reverse-engineer-invoice-schema.ts, but against D365 OData
 * instead of LamLinks SQL.
 *
 * For each column on headers + lines:
 *   - null rate
 *   - distinct-value count
 *   - auto vs constant vs small-set vs variable
 *
 * Also:
 *   - dumps ONE complete chain (header + its lines) with all populated
 *     fields, so we can eyeball the shape of a real PO
 *   - state-field probe: what values of PurchaseOrderStatus /
 *     DocumentState actually exist + their counts
 *   - prints refined standing questions at the end
 *
 * Side-effect: writes two JSON files to data/d365/ so we can re-read
 * them without another OData round-trip while iterating on design.
 *
 *   npx tsx scripts/reverse-engineer-ax-po-schema.ts
 */
import "./env";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365_URL = process.env.AX_D365_URL!;
const OUTPUT_DIR = join(__dirname, "..", "data", "d365");

const SAMPLE_SIZE = 50;

// Entity names differ across D365 versions. Try the most likely first
// and fall back. PurchaseOrderHeadersV2 is the standard name in the
// current Supply Chain Management entity model.
const HEADER_ENTITIES = [
  "PurchaseOrderHeadersV2",
  "PurchaseOrderHeaderV2",
  "PurchaseOrderHeaders",
];

async function getToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365_URL}/.default`,
  });
  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const data: any = await resp.json();
  if (!data.access_token) throw new Error("Auth failed: " + data.error_description);
  return data.access_token;
}

async function fetchJson(token: string, url: string): Promise<any> {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} on ${url.slice(0, 80)}…  ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

/**
 * Find the header entity name that actually works on this tenant.
 * Probes by asking for $top=1. First success wins.
 */
async function resolveHeaderEntity(token: string): Promise<string> {
  for (const name of HEADER_ENTITIES) {
    try {
      await fetchJson(token, `${D365_URL}/data/${name}?cross-company=true&$top=1`);
      console.log(`  ✓ header entity: ${name}`);
      return name;
    } catch (e: any) {
      console.log(`  ✗ ${name}: ${String(e?.message || "").split("\n")[0].slice(0, 120)}`);
    }
  }
  throw new Error("None of the known PO header entity names are reachable — check AX permissions.");
}

function classify(values: any[], colname: string): string {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const nullRate = 1 - nonNull.length / values.length;
  const distinct = new Set(nonNull.map((v) => JSON.stringify(v)));

  const lc = colname.toLowerCase();
  const looksLikeTime = /date$|datetime|created|modified/.test(lc);
  const looksLikeUser = /modifiedby|createdby|requester|employee|personnel/.test(lc);
  const looksLikeInternalId = /recid$|internalid|^odata|@odata|etag/.test(lc);

  if (nullRate === 1) return "🚫 always null — skip on INSERT";
  if (looksLikeInternalId) return `🔑 auto internal id — DO NOT send on insert`;
  if (looksLikeTime) return `⏰ timestamp (${distinct.size} distinct)`;
  if (looksLikeUser) return `👤 user/principal (${distinct.size} distinct: ${[...distinct].slice(0, 2).join(", ")})`;
  if (distinct.size === 1) return `📌 constant: ${[...distinct][0]}`;
  if (distinct.size <= 5) return `🔢 small set (${distinct.size}): ${[...distinct].slice(0, 5).join(" | ")}`;
  if (nullRate > 0.8)
    return `⚪ usually null (${Math.round(nullRate * 100)}% null, ${distinct.size} distinct when set)`;
  if (nullRate > 0.3) return `~ sometimes null (${Math.round(nullRate * 100)}% null)`;
  return `✏️ varies (${distinct.size} distinct of ${values.length})`;
}

function sampleValues(values: any[], max = 3): string {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const distinct = [...new Set(nonNull.map((v) => JSON.stringify(v)))].slice(0, max);
  return distinct.join(" | ");
}

function analyzeRows(rows: any[], label: string) {
  console.log(`\n${"=".repeat(80)}\n${label}\n${"=".repeat(80)}`);
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }
  // Union of keys — OData sometimes omits null fields from each row
  const allKeys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) allKeys.add(k);
  const cols = [...allKeys].sort();
  console.log(`${rows.length} rows, ${cols.length} distinct columns:\n`);
  const pad = Math.max(...cols.map((c) => c.length)) + 2;
  for (const c of cols) {
    const values = rows.map((r) => r[c] ?? null);
    const cls = classify(values, c);
    const sample = sampleValues(values, 3);
    console.log(`  ${c.padEnd(pad)} ${cls}`);
    if (!cls.includes("constant:") && !cls.includes("small set") && sample && sample !== '""') {
      const short = sample.length > 90 ? sample.slice(0, 90) + "..." : sample;
      console.log(`  ${"".padEnd(pad)}   e.g. ${short}`);
    }
  }
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("=== AX PURCHASE ORDER RECON ===\n");
  console.log("1. Authenticating...");
  const token = await getToken();

  console.log("\n2. Resolving header entity name...");
  const headerEntity = await resolveHeaderEntity(token);

  // Pull the 50 most recent headers. We don't know the best sort field
  // yet so try a few likely candidates.
  console.log(`\n3. Fetching ${SAMPLE_SIZE} most recent ${headerEntity}...`);
  let headers: any[] = [];
  const sortCandidates = ["PurchaseOrderPlacedDate desc", "OrderedDate desc", "CreatedDateTime desc"];
  for (const sort of sortCandidates) {
    try {
      const r = await fetchJson(
        token,
        `${D365_URL}/data/${headerEntity}?cross-company=true&$top=${SAMPLE_SIZE}&$orderby=${encodeURIComponent(sort)}`
      );
      headers = r.value || [];
      if (headers.length > 0) {
        console.log(`  ✓ sorted by ${sort} — got ${headers.length} rows`);
        break;
      }
    } catch (e: any) {
      console.log(`  ✗ ${sort}: ${String(e?.message || "").split("\n")[0].slice(0, 100)}`);
    }
  }
  if (headers.length === 0) {
    // Last-ditch: no sort
    const r = await fetchJson(token, `${D365_URL}/data/${headerEntity}?cross-company=true&$top=${SAMPLE_SIZE}`);
    headers = r.value || [];
    console.log(`  fallback (no sort): ${headers.length} rows`);
  }
  writeFileSync(join(OUTPUT_DIR, "po-headers-sample.json"), JSON.stringify(headers, null, 2));

  // Identify PO numbers so we can pull the matching lines.
  const poNumberKey = ["PurchaseOrderNumber", "POnumber", "PurchOrderNumber"].find(
    (k) => headers[0] && k in headers[0]
  );
  if (!poNumberKey) {
    console.log("  WARNING: no PurchaseOrderNumber field on headers — lines join will be manual.");
  }
  const poNumbers = poNumberKey
    ? headers.map((h: any) => h[poNumberKey]).filter(Boolean)
    : [];
  console.log(`  PO number field on headers: ${poNumberKey || "(not found)"}`);

  console.log(`\n4. Fetching all lines for those ${poNumbers.length} POs...`);
  let lines: any[] = [];
  if (poNumbers.length > 0) {
    // Chunk the $filter — AX is fine with ~50 values but be conservative
    for (let i = 0; i < poNumbers.length; i += 20) {
      const chunk = poNumbers.slice(i, i + 20);
      const filter = chunk.map((n) => `PurchaseOrderNumber eq '${String(n).replace(/'/g, "''")}'`).join(" or ");
      const r = await fetchJson(
        token,
        `${D365_URL}/data/PurchaseOrderLinesV2?cross-company=true&$filter=${encodeURIComponent(filter)}`
      );
      lines.push(...(r.value || []));
    }
  }
  writeFileSync(join(OUTPUT_DIR, "po-lines-sample.json"), JSON.stringify(lines, null, 2));
  console.log(`  ${lines.length} lines pulled`);

  // Analyze
  analyzeRows(headers, `${headerEntity} — 50 most recent PO headers`);
  analyzeRows(lines, `PurchaseOrderLinesV2 — lines for those headers`);

  // State field probe
  console.log(`\n${"=".repeat(80)}\nSTATE FIELD PROBE\n${"=".repeat(80)}`);
  const stateCandidates = ["PurchaseOrderStatus", "DocumentState", "PurchaseOrderLineStatus"];
  for (const key of stateCandidates) {
    const values = headers.map((h: any) => h[key]).concat(lines.map((l: any) => l[key]));
    const nonNull = values.filter((v) => v);
    if (nonNull.length === 0) continue;
    const counts: Record<string, number> = {};
    for (const v of nonNull) counts[String(v)] = (counts[String(v)] || 0) + 1;
    console.log(`  ${key}:`);
    for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${n.toString().padStart(4)}  ${k}`);
    }
  }

  // One complete chain
  if (headers.length > 0 && poNumbers.length > 0) {
    console.log(`\n${"=".repeat(80)}\nONE COMPLETE CHAIN — most recent PO\n${"=".repeat(80)}`);
    const h = headers[0];
    const poNum = h[poNumberKey!];
    console.log(`Header (${poNum}):`);
    for (const [k, v] of Object.entries(h)) {
      if (v !== null && v !== undefined && v !== "" && v !== 0) {
        const shown = JSON.stringify(v);
        console.log(`  ${k.padEnd(40)} = ${String(shown).slice(0, 100)}`);
      }
    }
    const theseLines = lines.filter((l: any) => l.PurchaseOrderNumber === poNum);
    console.log(`\n${theseLines.length} line(s):`);
    for (const l of theseLines) {
      console.log(`  ---`);
      for (const [k, v] of Object.entries(l)) {
        if (v !== null && v !== undefined && v !== "" && v !== 0) {
          const shown = JSON.stringify(v);
          console.log(`  ${k.padEnd(40)} = ${String(shown).slice(0, 100)}`);
        }
      }
    }
  }

  // Refined questions based on what we actually saw
  console.log(`\n${"=".repeat(80)}\nREFINED QUESTIONS (derived from sample)\n${"=".repeat(80)}`);
  if (headers[0]) {
    const h0 = headers[0];
    const allNullable = Object.entries(h0).filter(([_, v]) => v === null || v === "").length;
    console.log(`  - Sample header has ${Object.keys(h0).length} fields, ${allNullable} are null/empty. Only populated ones are load-bearing.`);
    const legalEntity = h0.dataAreaId;
    if (legalEntity) console.log(`  - dataAreaId on this tenant: '${legalEntity}'.`);
    const vendorFields = Object.keys(h0).filter((k) => /vendor/i.test(k));
    if (vendorFields.length) console.log(`  - Vendor fields on header: ${vendorFields.join(", ")}`);
    const addrFields = Object.keys(h0).filter((k) => /address|shipping|delivery/i.test(k));
    if (addrFields.length > 0) console.log(`  - Address/shipping fields: ${addrFields.slice(0, 8).join(", ")}${addrFields.length > 8 ? ", ..." : ""}`);
  }
  console.log("\nNext step: open docs/flows/ax-po-writeback.md, mark every [G] assumption as");
  console.log("[ANSWERED] if the sample above confirms/disconfirms it, and whittle the");
  console.log("Standing Questions list down to what the sample truly can't answer.");
  console.log(`\nRaw JSON for further exploration:`);
  console.log(`  ${join(OUTPUT_DIR, "po-headers-sample.json")}`);
  console.log(`  ${join(OUTPUT_DIR, "po-lines-sample.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
