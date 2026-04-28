// Send the 2026-04-27 REST API brief to Shmuel's WhatsApp.
import "./env";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

const PDF = "C:\\Users\\ssokol\\Desktop\\Yosef-DIBS-REST-API-Brief-2026-04-27.pdf";
const PHONE = "5162367397"; // Shmuel
const MESSAGE = `DIBS REST API brief for Yosef (2026-04-27). Today's findings: Sally REST creds work, IP whitelist confirmed real, architecture for the worker is built but not deployed. Three questions for Yosef inside (whitelist scope, function ACL, hosting box). Forward when ready.`;

async function main() {
  if (!existsSync(PDF)) { console.error(`PDF not found: ${PDF}`); process.exit(1); }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const pdfBuf = readFileSync(PDF);
  const fileName = `yosef-rest-brief-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.pdf`;
  await supabase.storage.createBucket("briefings", { public: true }).catch(() => {});
  const { error: upErr } = await supabase.storage.from("briefings").upload(fileName, pdfBuf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) { console.error("upload error:", upErr.message); process.exit(2); }
  const { data } = supabase.storage.from("briefings").getPublicUrl(fileName);
  const pdfUrl = data.publicUrl;
  console.log(`PDF uploaded: ${pdfUrl}`);

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error("Twilio env missing");
    process.exit(3);
  }
  const toNum = PHONE.replace(/[^0-9+]/g, "");
  const whatsappTo = `whatsapp:${toNum.startsWith("+") ? toNum : `+1${toNum}`}`;
  const whatsappFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

  const params = new URLSearchParams({ To: whatsappTo, From: whatsappFrom, Body: MESSAGE });
  params.append("MediaUrl", pdfUrl);

  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const result: any = await resp.json();
  if (!resp.ok) { console.error("Twilio error:", result); process.exit(4); }
  console.log(`Sent! SID=${result.sid} Status=${result.status} To=${whatsappTo}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
