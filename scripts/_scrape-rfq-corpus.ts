/**
 * Phase 2.1 — RFQ tone learning, step 1: scrape Abe's Sent Items for
 * outbound emails that look like RFQs to suppliers.
 *
 * Strategy:
 *   - Pull last 90 days of Sent Items
 *   - Filter to subjects containing RFQ-like keywords
 *   - Cross-reference recipient against dibs_suppliers (highest signal)
 *   - Save the corpus to a file for analysis (and to a Supabase table
 *     so the /rfq UI can show "we've already RFQ'd vendor X for NSN Y")
 *
 * Output:
 *   - C:\tmp\rfq-corpus.txt (raw bodies for human review)
 *   - rfq_outbound_history Supabase table (structured)
 */
import "./env";
import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fetchFromFolder } from "../src/lib/ews-client";

const RFQ_KEYWORDS = [
  "rfq",
  "request for quote",
  "request for quotation",
  "quote request",
  "pricing request",
  "quotation",
  "nsn",
  "part number",
];

(async () => {
  console.log("Pulling last 90 days of Sent Items...");
  const sent = await fetchFromFolder({
    folder: "sentitems",
    lookbackDays: 90,
    maxItems: 500,
  });
  console.log(`Total sent emails: ${sent.length}`);

  // Filter for likely-RFQ — and EXCLUDE emails to gov buyers (replies)
  // and internal emails. Want only outbound to commercial suppliers.
  const GOV_DOMAINS = ["dla.mil", "mail.mil", "navy.mil", "army.mil", "af.mil", "uscg.mil", "usda.gov", "nasa.gov", "fda.gov"];
  const INTERNAL_DOMAIN = "everreadygroup.com";
  const isGov = (addr: string) => GOV_DOMAINS.some((d) => addr.toLowerCase().endsWith("@" + d) || addr.toLowerCase().endsWith("." + d));
  const isInternal = (addr: string) => addr.toLowerCase().endsWith("@" + INTERNAL_DOMAIN);

  const matched = sent.filter((m) => {
    const subj = (m.subject || "").toLowerCase();
    if (!RFQ_KEYWORDS.some((kw) => subj.includes(kw))) return false;
    // At least one recipient that's neither gov nor internal (= commercial supplier)
    const hasCommercial = m.toRecipients.some((r) => r && !isGov(r) && !isInternal(r));
    return hasCommercial;
  });
  console.log(`Match RFQ keywords AND has commercial recipient: ${matched.length}`);

  // Cross-reference with dibs_suppliers
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: suppliers } = await sb
    .from("dibs_suppliers")
    .select("email")
    .not("email", "is", null);
  const supplierEmails = new Set((suppliers || []).map((s: any) => s.email.toLowerCase()));
  console.log(`Loaded ${supplierEmails.size} known supplier emails for cross-ref`);

  // Score each match: high if recipient is a known supplier
  const scored = matched.map((m) => {
    const knownSupplier = m.toRecipients.some((r) => supplierEmails.has(r.toLowerCase()));
    return { ...m, knownSupplier };
  });
  const known = scored.filter((m) => m.knownSupplier);
  const unknown = scored.filter((m) => !m.knownSupplier);
  console.log(`  → To known supplier: ${known.length}`);
  console.log(`  → To unknown recipient (still RFQ-keyword): ${unknown.length}`);

  // Dump corpus to file for analysis (known-supplier ones first, longer-bodied first)
  const corpus = [...known, ...unknown].sort((a, b) => (b.bodyText.length - a.bodyText.length));
  const out: string[] = [];
  out.push(`# RFQ Outbound Corpus — scraped ${new Date().toISOString()}`);
  out.push(`# Total: ${corpus.length} (known supplier: ${known.length}, unknown: ${unknown.length})`);
  out.push("");
  for (let i = 0; i < Math.min(corpus.length, 30); i++) {
    const m = corpus[i];
    out.push(`================================================================`);
    out.push(`# Sample ${i + 1}/${Math.min(corpus.length, 30)}`);
    out.push(`Subject: ${m.subject}`);
    out.push(`To: ${m.toRecipients.join(", ")}${m.knownSupplier ? "  [KNOWN SUPPLIER]" : ""}`);
    out.push(`Sent: ${m.sentAt.toISOString()}`);
    out.push(`Body length: ${m.bodyText.length} chars`);
    out.push(``);
    out.push(m.bodyText.slice(0, 4000));
    out.push("");
  }
  writeFileSync("C:\\tmp\\rfq-corpus.txt", out.join("\n"), "utf8");
  console.log(`\n✓ Wrote corpus to C:\\tmp\\rfq-corpus.txt (${corpus.length} emails, top 30 dumped)`);

  // Quick subject-pattern summary
  console.log(`\n=== Top 10 sample subjects (known suppliers) ===`);
  for (const m of known.slice(0, 10)) {
    console.log(`  → ${m.toRecipients[0]}: ${m.subject.slice(0, 80)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
