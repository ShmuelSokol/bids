/**
 * Smoke-test the SFTP upload mechanics with a clearly-non-EDI filename
 * (Sally polls /incoming/ for files matching a<seq>_<customer>_<rand>.laz —
 * something like "dibs-sftp-test-XYZ.laz" should NOT match and be ignored).
 *
 * After upload, list /incoming/ to confirm the file appeared, then DELETE
 * our test file so we don't pollute Sally's pickup folder.
 */
import "./env";
import Sftp from "ssh2-sftp-client";

(async () => {
  const sftp = new Sftp();
  try {
    await sftp.connect({
      host: process.env.LL_SFTP_HOST!,
      port: Number(process.env.LL_SFTP_PORT ?? 22),
      username: process.env.LL_SFTP_USER!,
      password: process.env.LL_SFTP_PASS!,
      readyTimeout: 15000,
      hostVerifier: () => true,
    });
    console.log("✓ Connected.");

    const testName = `dibs-sftp-test-${Date.now()}.txt`;
    const testContent = Buffer.from(`DIBS SFTP smoke test ${new Date().toISOString()}\nDelete me — not an EDI.\n`);

    console.log(`\nUploading ${testName} (${testContent.length} bytes)...`);
    await sftp.put(testContent, `/incoming/${testName}`);
    console.log("✓ Upload complete.");

    const list = await sftp.list("/incoming");
    const found = list.find((e: any) => e.name === testName);
    console.log(`\nFile exists in /incoming/: ${found ? `✓ (size=${found.size})` : "✗ NOT FOUND"}`);

    console.log(`\nDeleting test file...`);
    await sftp.delete(`/incoming/${testName}`);
    console.log("✓ Cleanup complete. Upload mechanism verified.");
  } finally {
    try { await sftp.end(); } catch {}
  }
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
