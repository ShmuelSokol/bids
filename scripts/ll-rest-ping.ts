/**
 * Heartbeat probe for api.lamlinks.com via the Sally REST API.
 *
 * Calls the `are_you_listening` function with our credentials and prints
 * the response. Unblocked the moment LL_API_KEY + LL_API_SECRET are set
 * in .env (pulled from LLPro.ini on any LL workstation).
 *
 *   npx tsx scripts/ll-rest-ping.ts
 */
import "./env";
import { callLisFunction, credentialsFromEnv } from "../src/lib/lamlinks-rest";

async function main() {
  const creds = credentialsFromEnv();
  console.log(`LamLinks ping — host=${creds.hostname ?? "api.lamlinks.com"} login=${creds.sallyLogin} e_code=${creds.eCode}\n`);

  const started = Date.now();
  const resp = await callLisFunction(creds, "are_you_listening", "");
  const elapsed = Date.now() - started;

  console.log(`HTTP status:       ${resp.httpStatus}`);
  console.log(`Round-trip:        ${elapsed}ms`);
  console.log(`Response comp_code ${resp.compCode}`);
  console.log(`Response message:  ${resp.message}`);
  console.log(`Response data_xml: ${resp.dataXml?.slice(0, 200) ?? "(none)"}`);
  console.log(`\nRaw (first 500 chars):\n${resp.rawResponse.slice(0, 500)}`);

  if (resp.httpStatus === 200 && resp.compCode === 0) {
    console.log(`\n✅ LamLinks API is reachable and our credentials are valid.`);
  } else if (resp.httpStatus === 401) {
    console.log(`\n❌ 401 Unauthorized. Common causes:`);
    console.log(`   - Wrong api_key / api_secret (check LLPro.ini on a different workstation)`);
    console.log(`   - sally_login doesn't match the api_key's owner e_code`);
    console.log(`   - ERG's LL installation never had Sally API activated`);
  } else {
    console.log(`\n⚠️  Unexpected response. Inspect raw output above.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
