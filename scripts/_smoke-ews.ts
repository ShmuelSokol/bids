/**
 * EWS connection smoke test.
 * Tests basic connectivity to mail.everreadygroup.com using the credentials
 * in .env (EWS_SERVER, EWS_DOMAIN, EWS_USER, EWS_PASSWORD).
 *
 * If this fails:
 *   - Check the EWS_PASSWORD value (matches what masterdb has stored)
 *   - Check the EWS_DOMAIN — masterdb's email_config.ews_domain column
 *     is the source of truth
 *   - Confirm `mail.everreadygroup.com` is reachable from this machine
 */
import "./env";
import { testEwsConnection, fetchFromSender } from "../src/lib/ews-client";

(async () => {
  console.log(`Testing EWS connection to ${process.env.EWS_SERVER || "(default)"} as ${process.env.EWS_USER}...`);
  const t = await testEwsConnection();
  if (!t.ok) {
    console.error(`✗ ${t.message}`);
    process.exit(1);
  }
  console.log(`✓ ${t.message}`);

  // Try a sample fetch — the WAWF noreply address. Last 3 days.
  console.log(`\nFetching last 3 days of WAWF emails...`);
  const emails = await fetchFromSender(
    "disa.ogden.eis.mbx.wawfnoreply@mail.mil",
    3 * 24 * 60,
    10,
  );
  console.log(`Found ${emails.length} WAWF emails (showing first 5):`);
  for (const e of emails.slice(0, 5)) {
    console.log(`  [${e.receivedAt.toISOString()}] ${e.subject.slice(0, 80)}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
