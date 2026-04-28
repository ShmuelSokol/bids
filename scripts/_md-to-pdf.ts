/**
 * Convert a Markdown file to PDF via Playwright (Chromium print).
 *   npx tsx scripts/_md-to-pdf.ts <input.md> <output.pdf>
 */
import "./env";
import { readFileSync, writeFileSync } from "fs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { marked } = require("marked");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright");

const CSS = `
@page { size: Letter; margin: 0.75in; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1a1a1a; line-height: 1.55; max-width: 7in;
  margin: 0 auto; padding: 0;
}
h1 { color: #0b3d91; border-bottom: 2px solid #0b3d91; padding-bottom: 0.25em; margin-top: 0; }
h2 { color: #0b3d91; border-bottom: 1px solid #cfd8e3; padding-bottom: 0.2em; margin-top: 1.5em; page-break-after: avoid; }
h3 { color: #0b3d91; margin-top: 1.2em; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95em; }
th, td { border: 1px solid #cfd8e3; padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: #f3f6fa; font-weight: 600; }
code { background: #f3f6fa; padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
pre { background: #f3f6fa; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 0.85em; line-height: 1.4; page-break-inside: avoid; }
pre code { background: transparent; padding: 0; }
hr { border: 0; border-top: 1px solid #cfd8e3; margin: 2em 0; }
ul, ol { padding-left: 1.5em; }
li { margin-bottom: 0.3em; }
strong { color: #0b3d91; }
blockquote { border-left: 3px solid #0b3d91; margin: 1em 0; padding: 0.5em 1em; background: #f3f6fa; color: #444; }
a { color: #0b3d91; }
`;

async function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) { console.error("Usage: <input.md> <output.pdf>"); process.exit(1); }

  const md = readFileSync(inPath, "utf-8");
  const bodyHtml = marked.parse(md);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DIBS Brief</title><style>${CSS}</style></head><body>${bodyHtml}</body></html>`;

  const tmpHtml = outPath.replace(/\.pdf$/i, ".tmp.html");
  writeFileSync(tmpHtml, html, "utf-8");

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file:///" + tmpHtml.replace(/\\/g, "/"), { waitUntil: "load" });
  await page.pdf({ path: outPath, format: "Letter", margin: { top: "0.75in", bottom: "0.75in", left: "0.75in", right: "0.75in" }, printBackground: true });
  await browser.close();

  console.log(`✓ ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
