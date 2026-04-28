// Send the Yosef API-access brief to Shmuel's WhatsApp.
// Reuses the same Twilio + Supabase Storage plumbing as send-daily-briefing.
import "./env";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

const PDF = "C:\\Users\\ssokol\\Desktop\\Yosef-DIBS-LL-API-Brief.pdf";
const PHONE = process.argv.includes("--phone")
  ? process.argv[process.argv.indexOf("--phone") + 1]
  : "5162367397"; // Shmuel's number (default from daily briefing)
const MESSAGE = `Brief for Yosef: DIBS <-> LL API access request. Context: today's writeback test (2026-04-24) shipped one bid end-to-end but hit VFP cursor errors. Patched a fix; we still want Sally api_key/api_secret to fully automate. Forward the attached PDF to Yosef when ready.`;

async function main() {
  if (!existsSync(PDF)) { console.error(`PDF not found: ${PDF}`); process.exit(1); }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Upload to Supabase Storage
  const pdfBuf = readFileSync(PDF);
  const fileName = `yosef-brief-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.pdf`;
  await supabase.storage.createBucket("briefings", { public: true }).catch(() => {});
  const { error: upErr } = await supabase.storage.from("briefings").upload(fileName, pdfBuf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) { console.error("upload error:", upErr.message); process.exit(2); }
  const { data } = supabase.storage.from("briefings").getPublicUrl(fileName);
  const pdfUrl = data.publicUrl;
  console.log(`PDF uploaded: ${pdfUrl}`);

  // Send via Twilio WhatsApp
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error("Twilio env missing — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM");
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
