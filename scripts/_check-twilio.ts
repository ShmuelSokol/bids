import "./env";
(async () => {
  const sid = "MM081790a3571ebab00713ceb710eccafb";
  const acct = process.env.TWILIO_ACCOUNT_SID!;
  const tok = process.env.TWILIO_AUTH_TOKEN!;
  const auth = Buffer.from(`${acct}:${tok}`).toString("base64");
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/Messages/${sid}.json`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const j: any = await r.json();
  console.log("Status:", j.status);
  console.log("Error code:", j.error_code);
  console.log("Error message:", j.error_message);
  console.log("Date sent:", j.date_sent);
  console.log("Date updated:", j.date_updated);
})();
