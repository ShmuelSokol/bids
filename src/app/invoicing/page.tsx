import { createServiceClient } from "@/lib/supabase-server";
import { getSystemSetting } from "@/lib/system-settings";
import Link from "next/link";
import { InvoicingDashboard } from "./invoicing-dashboard";

async function getData() {
  const supabase = createServiceClient();

  // Awards used for invoicing. Paginated — but NEVER `select("*")`. The
  // `awards` table has 74K+ rows and a wide schema; pulling everything
  // produced a ~41MB response to the browser, causing slow renders and
  // memory pressure. Select only the columns the InvoicingDashboard
  // actually reads, and cap at a reasonable window (90 days of awards,
  // most recent 10K) — older awards are already invoiced.
  const AWARDS_COLS =
    "id, cage, contract_number, fsc, niin, description, unit_price, quantity, award_date, fob, po_generated";
  const MAX_AWARD_ROWS = 10_000;
  const allAwards: any[] = [];
  let awPage = 0;
  while (allAwards.length < MAX_AWARD_ROWS) {
    const { data } = await supabase
      .from("awards")
      .select(AWARDS_COLS)
      .eq("cage", "0AG09")
      .order("award_date", { ascending: false })
      .range(awPage * 1000, (awPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allAwards.push(...data);
    if (data.length < 1000) break;
    awPage++;
    if (awPage >= MAX_AWARD_ROWS / 1000) break;
  }
  const awards = allAwards;

  // PO lines with cost/sell data — paginate to avoid 1000-row cap
  const allPoLines: any[] = [];
  for (let p = 0; p < 20; p++) {
    const { data } = await supabase
      .from("po_lines")
      .select("*, purchase_orders(po_number, supplier, status, created_by)")
      .order("id", { ascending: false })
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allPoLines.push(...data);
    if (data.length < 1000) break;
  }

  // Load bid decisions that were submitted — paginate
  const allSubmitted: any[] = [];
  for (let p = 0; p < 20; p++) {
    const { data } = await supabase
      .from("bid_decisions")
      .select("*")
      .eq("status", "submitted")
      .order("updated_at", { ascending: false })
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allSubmitted.push(...data);
    if (data.length < 1000) break;
  }

  // Sync log for last invoice generation
  const { data: lastInvoiceSync } = await supabase
    .from("sync_log")
    .select("*")
    .eq("action", "invoice_generated")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return {
    awards: awards || [],
    poLines: allPoLines,
    submittedBids: allSubmitted,
    lastInvoiceSync,
  };
}

export default async function InvoicingPage() {
  const { awards, poLines, submittedBids, lastInvoiceSync } = await getData();
  const invoiceWritebackLive = (await getSystemSetting("lamlinks_invoice_writeback_enabled")) === "true";

  return (
    <div className="p-4 md:p-8">
      {invoiceWritebackLive ? (
        <div className="mb-4 rounded-lg border-2 border-green-400 bg-green-50 px-4 py-2 flex items-center justify-between text-sm">
          <div>
            <span className="font-bold text-green-800">🟢 LamLinks Invoice Write-Back is LIVE</span>
            <span className="text-green-700 ml-2">— clicking &quot;Post to LamLinks&quot; on a selection writes a draft invoice Yosef can Post without desktop-app click-through.</span>
          </div>
          <Link href="/settings/lamlinks-invoice-writeback" className="text-xs text-green-800 underline">manage</Link>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-2 flex items-center justify-between text-sm">
          <div>
            <span className="font-bold text-amber-800">⏳ LamLinks Invoice Write-Back is PRE-LIVE</span>
            <span className="text-amber-700 ml-2">— today&apos;s Generate EDI 810 flow still works. Write-back goes LIVE after Q7 test with Yosef (see <Link href="/settings/lamlinks-invoice-writeback" className="underline">settings</Link>).</span>
          </div>
          <Link href="/settings/lamlinks-invoice-writeback" className="text-xs text-amber-800 underline">manage</Link>
        </div>
      )}
      <InvoicingDashboard
        awards={awards}
        poLines={poLines}
        submittedBids={submittedBids}
        lastInvoiceSync={lastInvoiceSync}
      />
    </div>
  );
}
