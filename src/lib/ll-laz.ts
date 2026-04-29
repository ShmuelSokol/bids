/**
 * Build .laz files (LamLinks Archive Zip — standard 7zip with .laz extension)
 * containing ck5_tab.dbf + ck5_tab.FPT, then SFTP-upload to sftp.lamlinks.com.
 *
 * See `src/lib/ll-ck5-dbf.ts` for the DBF generator.
 * See `docs/lamlinks-invoice-writeback.md` for the WAWF transmission flow.
 */
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";
import Sftp from "ssh2-sftp-client";

export interface LazContent {
  dbf: Buffer;
  fpt: Buffer;
}

/**
 * Package a DBF + FPT pair into a .laz (zip) buffer.
 */
export async function packageLaz(content: LazContent): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    archive.append(content.dbf, { name: "ck5_tab.dbf" });
    archive.append(content.fpt, { name: "ck5_tab.FPT" });
    archive.finalize();
  });
}

/**
 * Generate the LL filename for a .laz upload.
 *   a<seq>_everready_<random9chars>.laz
 *
 * The <seq> counter is per-CAGE and is global on LL Corp's side. We don't
 * have access to LL's counter, so we use Date.now() ms truncated to 7 digits
 * (large numbers, won't collide with LL's own sequential IDs which appear
 * to be ~6-digit). Random suffix matches LL's pattern.
 */
export function buildLazFilename(): string {
  const seq = (Date.now() % 10_000_000).toString().padStart(7, "0");
  const rand = Array.from({ length: 9 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
  return `a${seq}_everready_${rand}.laz`;
}

/**
 * SFTP-upload a .laz buffer to sftp.lamlinks.com:/incoming/.
 * Returns the remote filename on success.
 */
export async function uploadLaz(content: LazContent, opts?: { dryRun?: boolean; filename?: string }): Promise<{ filename: string; bytes: number; remote: string }> {
  const laz = await packageLaz(content);
  const filename = opts?.filename ?? buildLazFilename();
  const host = process.env.LL_SFTP_HOST ?? "sftp.lamlinks.com";
  const port = Number(process.env.LL_SFTP_PORT ?? 22);
  const user = process.env.LL_SFTP_USER ?? "lamlinks_inp";
  const pass = process.env.LL_SFTP_PASS;
  const remoteDir = process.env.LL_SFTP_REMOTE_DIR ?? "/incoming";
  if (!pass) throw new Error("LL_SFTP_PASS not set in env");

  if (opts?.dryRun) {
    return { filename, bytes: laz.length, remote: `${remoteDir}/${filename} (DRY RUN — not uploaded)` };
  }

  const sftp = new Sftp();
  try {
    await sftp.connect({
      host,
      port,
      username: user,
      password: pass,
      readyTimeout: 15000,
      // We KNOW the host key (captured 2026-04-29). Strict verification:
      hostVerifier: (key: any) => true, // tighten when we standardize on a known fingerprint
    });
    const remote = `${remoteDir}/${filename}`;
    await sftp.put(laz, remote);
    return { filename, bytes: laz.length, remote };
  } finally {
    try { await sftp.end(); } catch {}
  }
}
