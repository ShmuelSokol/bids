import { createServiceClient } from "@/lib/supabase-server";
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

  // PO lines with cost/sell data
  const { data: poLines } = await supabase
    .from("po_lines")
    .select("*, purchase_orders(po_number, supplier, status, created_by)")
    .order("id", { ascending: false })
    .limit(1000);

  // Load bid decisions that were submitted (these map to contracts we need to invoice)
  const { data: submittedBids } = await supabase
    .from("bid_decisions")
    .select("*")
    .eq("status", "submitted")
    .order("updated_at", { ascending: false })
    .limit(500);

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
    poLines: poLines || [],
    submittedBids: submittedBids || [],
    lastInvoiceSync,
  };
}

export default async function InvoicingPage() {
  const { awards, poLines, submittedBids, lastInvoiceSync } = await getData();

  return (
    <div className="p-4 md:p-8">
      <InvoicingDashboard
        awards={awards}
        poLines={poLines}
        submittedBids={submittedBids}
        lastInvoiceSync={lastInvoiceSync}
      />
    </div>
  );
}
