import { createServiceClient } from "@/lib/supabase-server";
import { InvoicingDashboard } from "./invoicing-dashboard";

async function getData() {
  const supabase = createServiceClient();

  // Awards that have been shipped but not yet invoiced
  // These are awards with po_generated=true (PO created)
  // Paginate awards past 1K default
  const allAwards: any[] = [];
  let awPage = 0;
  while (true) {
    const { data } = await supabase
      .from("awards")
      .select("*")
      .eq("cage", "0AG09")
      .order("award_date", { ascending: false })
      .range(awPage * 1000, (awPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allAwards.push(...data);
    if (data.length < 1000) break;
    awPage++;
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
