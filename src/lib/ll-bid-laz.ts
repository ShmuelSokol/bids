/**
 * Build + transmit the bid-side .laz for SFTP upload to sftp.lamlinks.com.
 *
 * Captured 2026-04-29 via procmon: LL UI on a fresh envelope Post emits ONE
 * .laz containing qtb_tab.dbf + qtb_tab.FPT (multi-record, one record per
 * CLIN). Sally polls /incoming/, parses qtb, emits the bid into LL's k33/k34
 * tables, and forwards via DLA's bid intake.
 *
 * See:
 *   - ll-qtb-dbf.ts — the DBF/FPT generator (template-patch)
 *   - data/ll-templates/bid/ — captured reference DBF + FPT
 *   - ll-laz.ts — packaging + SFTP upload
 *
 * Env:
 *   LL_BID_DRY_RUN=1 — build the .laz, log size + filename, do NOT upload.
 */
import { uploadLaz, packageLaz, buildLazFilename } from "./ll-laz";
import { buildQtbDbf, QtbBidLineData } from "./ll-qtb-dbf";

export type { QtbBidLineData };

export interface BidEnvelopeData {
  idnk33: number;            // LL envelope id (for log + worker reconciliation)
  qotref?: string;           // 0AG09-46895 (informational)
  lines: QtbBidLineData[];
}

const TEMPLATE_DIR = "data/ll-templates/bid";

/**
 * Build the bid .laz and SFTP-upload to sftp.lamlinks.com:/incoming/.
 * Returns the filename used + uploaded byte count.
 */
export async function transmitBidEnvelope(
  envelope: BidEnvelopeData,
  opts?: { dryRun?: boolean; templateDir?: string }
): Promise<{ filename: string; bytes: number; remote: string; dryRun: boolean }> {
  if (envelope.lines.length === 0) {
    throw new Error(`transmitBidEnvelope: envelope ${envelope.idnk33} has no lines`);
  }
  const dryRun = opts?.dryRun ?? process.env.LL_BID_DRY_RUN === "1";
  const templateDir = opts?.templateDir ?? TEMPLATE_DIR;
  const { dbf, fpt } = buildQtbDbf(envelope.lines, templateDir);

  const filename = buildLazFilename();
  if (dryRun) {
    const lazBuf = await packageLaz([
      { name: "qtb_tab.dbf", data: dbf },
      { name: "qtb_tab.FPT", data: fpt },
    ]);
    console.log(`  [DRY RUN] Bid .laz built: ${filename} (${lazBuf.length} bytes, ${envelope.lines.length} CLIN${envelope.lines.length > 1 ? "s" : ""})`);
    return { filename, bytes: lazBuf.length, remote: "(dry-run)", dryRun: true };
  }

  const result = await uploadLaz(
    [
      { name: "qtb_tab.dbf", data: dbf },
      { name: "qtb_tab.FPT", data: fpt },
    ],
    { filename }
  );
  return { ...result, dryRun: false };
}
