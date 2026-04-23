/**
 * Walk a tree of decompiled VFP .prg files and extract every embedded
 * SQL string. Turns 50K lines of FoxPro source into a catalog of
 * every query LL fires, organized by source procedure.
 *
 *   npx tsx scripts/extract-sql-from-prg.ts <src_dir> [out_file]
 *
 * Example:
 *   npx tsx scripts/extract-sql-from-prg.ts C:\rev-eng\lamlinks\lamlinkspro-src ll-queries.md
 *
 * Output: Markdown file grouping queries by (source file → procedure),
 * with the SQL text + the 5-line context around each.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname, basename, relative } from "path";

const srcDir = process.argv[2];
const outFile = process.argv[3] || "ll-queries.md";
if (!srcDir) {
  console.error("Usage: npx tsx scripts/extract-sql-from-prg.ts <src_dir> [out_file]");
  process.exit(1);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (extname(p).toLowerCase() === ".prg") out.push(p);
  }
  return out;
}

// VFP SQL patterns:
//   SELECT ... FROM ...
//   SQLEXEC(handle, "SELECT ...", ...)
//   SQLEXEC(h, [SELECT ...], ...)
//   USE SQL ...
//   UPDATE / INSERT / DELETE as statements
const sqlPatterns = [
  // Single-quoted strings containing SQL keywords
  /(['"[])\s*(SELECT|INSERT|UPDATE|DELETE|EXEC|CREATE|DROP|ALTER|MERGE)\s+[^'"\]]{5,500}?\1/gi,
  // Bare SQL lines (not in strings) — common in .prg
  /^\s*(SELECT|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|REPLACE\s+\w+)\b.{0,500}/gim,
];

type Hit = { file: string; procedure: string; lineNo: number; sql: string; context: string[] };
const hits: Hit[] = [];

const files = walk(srcDir);
console.log(`Scanning ${files.length} .prg files...`);

for (const file of files) {
  let body: string;
  try {
    body = readFileSync(file, "utf-8");
  } catch {
    continue;
  }
  const lines = body.split("\n");

  // Track current procedure by walking for PROCEDURE / FUNCTION / DEFINE CLASS blocks.
  let currentProc = "(top-level)";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const procMatch = line.match(/^\s*(PROCEDURE|FUNCTION|DEFINE\s+CLASS)\s+([A-Za-z_]\w*)/i);
    if (procMatch) currentProc = `${procMatch[1].toUpperCase()} ${procMatch[2]}`;

    for (const pat of sqlPatterns) {
      const m = line.match(pat);
      if (!m) continue;
      const sqlText = m[0].trim();
      if (sqlText.length < 15) continue;
      // Grab 2 lines before and 2 after for context
      const ctx = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3));
      hits.push({ file, procedure: currentProc, lineNo: i + 1, sql: sqlText, context: ctx });
    }
  }
}

console.log(`Found ${hits.length} SQL statements.\n`);

// Group by (file, procedure)
const groups = new Map<string, Hit[]>();
for (const h of hits) {
  const key = `${relative(srcDir, h.file)} — ${h.procedure}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(h);
}

const out: string[] = [];
out.push(`# LamLinks embedded SQL catalog`);
out.push(``);
out.push(`Generated from decompiled source tree \`${srcDir}\`.`);
out.push(`**${hits.length}** SQL statements across **${files.length}** .prg files, grouped by source procedure.`);
out.push(``);
out.push(`## Table of contents`);
out.push(``);
for (const [key, rows] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  out.push(`- [${key}](#${slug}) — ${rows.length} stmt(s)`);
}
out.push(``);
for (const [key, rows] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  out.push(`## ${key}`);
  out.push(``);
  for (const h of rows) {
    out.push(`### line ${h.lineNo}`);
    out.push(``);
    out.push("```foxpro");
    out.push(h.context.join("\n"));
    out.push("```");
    out.push(``);
  }
}

writeFileSync(outFile, out.join("\n"), "utf-8");
console.log(`✅ Catalog written to ${outFile} (${hits.length} queries).`);
console.log(`\nGreppable questions:`);
console.log(`  grep -ni "k33_tab"       ${outFile}    # every touch of the envelope table`);
console.log(`  grep -ni "o_stat_k33"    ${outFile}    # every status-flip site`);
console.log(`  grep -ni "TABLEUPDATE"   ${outFile}    # cursor update calls`);
console.log(`  grep -ni "SQLEXEC"       ${outFile}    # ad-hoc SQL calls`);
