/**
 * Local .env loader for scripts. Replacement for `dotenv/config`.
 *
 * Why: CLAUDE.md forbids adding `dotenv` to package.json (its native
 * fast-parser crashes Railway builds). Using `--no-save` to install it
 * works but breaks any time `node_modules` is rebuilt fresh — which
 * is exactly what bit us when the Windows Task Scheduler tasks ran
 * for the first time.
 *
 * This module reads `.env` from the project root, parses it without
 * any dependencies, and assigns into `process.env`. Existing env vars
 * win (so Railway/Windows env config is never overridden by .env).
 *
 * Usage:
 *   import "./env";   // at the top of any script in scripts/*
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ENV_PATH = join(__dirname, "..", ".env");

if (existsSync(ENV_PATH)) {
  const text = readFileSync(ENV_PATH, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
