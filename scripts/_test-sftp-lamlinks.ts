/**
 * Test SFTP connectivity to sftp.lamlinks.com using captured creds.
 * Lists /incoming/ as a non-destructive smoke test.
 */
import "./env";
const Client = require("ssh2-sftp-client");

const HOST = "sftp.lamlinks.com";
const PORT = 22;
const USER = "lamlinks_inp";
const PASS = "Eo!l1vvW~";

(async () => {
  const sftp = new Client();
  try {
    console.log(`Connecting to ${HOST}:${PORT} as ${USER}...`);
    await sftp.connect({
      host: HOST,
      port: PORT,
      username: USER,
      password: PASS,
      readyTimeout: 15000,
      // Don't fail on host key mismatch first time — we know the host key fingerprint:
      // ssh-rsa 2048 d5:04:d4:87:f5:4f:ef:76:4c:26:8f:f6:ac:a7:3b:8a
      hostVerifier: () => true,
    });
    console.log("✓ Connected.\n");

    console.log("Real path of '.':");
    const cwd = await sftp.cwd();
    console.log(`  ${cwd}\n`);

    console.log("ls /incoming/ (just listing — no upload):");
    const list = await sftp.list("/incoming");
    console.log(`  ${list.length} entries (showing first 5):`);
    for (const e of list.slice(0, 5)) {
      console.log(`    ${e.type === "d" ? "<DIR>" : e.size.toString().padStart(8)}  ${e.name}  ${new Date(e.modifyTime).toISOString()}`);
    }

    await sftp.end();
    console.log("\n✓ Auth works. Path /incoming/ is reachable.");
  } catch (e: any) {
    console.error("✗ Failed:", e.message);
    try { await sftp.end(); } catch {}
    process.exit(1);
  }
})();
