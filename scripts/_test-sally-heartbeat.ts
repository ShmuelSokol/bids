// Simplest possible Sally REST test — call the "are_you_listening"
// heartbeat function to verify our credentials authenticate.
import "./env";
import { credentialsFromEnv, callLisFunction } from "../src/lib/lamlinks-rest";

(async () => {
  const creds = credentialsFromEnv();
  console.log(`Using: sally_login=${creds.sallyLogin}, e_code=${creds.eCode}, api_key=${creds.apiKey.slice(0,6)}...${creds.apiKey.slice(-4)}`);

  const resp = await callLisFunction(creds, "are_you_listening", "", 10);
  console.log("HTTP status:", resp.httpStatus);
  console.log("comp_code:", resp.compCode);
  console.log("message:", resp.message);
  console.log("\nraw response (first 1000 chars):");
  console.log(resp.rawResponse.slice(0, 1000));
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
