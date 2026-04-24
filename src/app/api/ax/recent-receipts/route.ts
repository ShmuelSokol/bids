import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Live AX read — show Abe the last N purchase receipts for an NSN
// (vendor, qty, unit cost, date) directly in the solicitation modal.
// Status "Invoiced" = received + billed. "Confirmed" = ordered, not in yet.

async function getAxToken() {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AX_CLIENT_ID!,
    client_secret: process.env.AX_CLIENT_SECRET!,
    scope: `${process.env.AX_D365_URL}/.default`,
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${process.env.AX_TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const d: any = await r.json();
  if (!d.access_token) throw new Error("AX auth failed: " + d.error_description);
  return d.access_token as string;
}

type Receipt = {
  po_number: string;
  line_number: number;
  vendor_account: string | null;
  vendor_name: string | null;
  qty: number;
  unit_price: number;
  total: number;
  status: string | null;
  date: string | null; // ISO; AccountingDate = when invoiced/received
};

export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn");
  const limit = Number(req.nextUrl.searchParams.get("limit") || 10);
  if (!nsn) return NextResponse.json({ error: "nsn required" }, { status: 400 });

  const supabase = createServiceClient();

  // NSN → ItemNumber. vendor_parts is the cleanest source (one row per vendor).
  const { data: vpRows } = await supabase
    .from("vendor_parts")
    .select("item_number")
    .eq("nsn", nsn);
  const itemNumbers = [...new Set((vpRows || []).map((r: any) => r.item_number).filter(Boolean))];
  if (itemNumbers.length === 0) {
    return NextResponse.json({ nsn, receipts: [] as Receipt[], reason: "no AX ItemNumber for NSN" });
  }

  const token = await getAxToken();
  const D365 = process.env.AX_D365_URL!;

  // Pull all lines for these item numbers. In practice it's 1 item so this is tiny.
  const itemFilter = itemNumbers.map((i) => `ItemNumber eq '${i}'`).join(" or ");
  const linesUrl =
    `${D365}/data/PurchaseOrderLinesV2?cross-company=true` +
    `&$top=200` +
    `&$filter=${encodeURIComponent(itemFilter)}` +
    `&$select=PurchaseOrderNumber,ItemNumber,LineNumber,OrderedPurchaseQuantity,PurchasePrice,PurchaseOrderLineStatus`;
  const lr = await fetch(linesUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!lr.ok) {
    return NextResponse.json({ nsn, receipts: [], error: `AX lines ${lr.status}` }, { status: 502 });
  }
  const lj: any = await lr.json();
  const lines: any[] = lj.value || [];
  if (lines.length === 0) return NextResponse.json({ nsn, receipts: [] });

  // Pull headers for vendor + date. Chunk in batches of 20 PO numbers per query.
  const poNums = [...new Set(lines.map((l) => l.PurchaseOrderNumber))];
  const headers: Record<string, any> = {};
  for (let i = 0; i < poNums.length; i += 20) {
    const chunk = poNums.slice(i, i + 20);
    const filter = chunk.map((p) => `PurchaseOrderNumber eq '${p}'`).join(" or ");
    const hdrUrl =
      `${D365}/data/PurchaseOrderHeadersV2?cross-company=true` +
      `&$filter=${encodeURIComponent(filter)}` +
      `&$select=PurchaseOrderNumber,OrderVendorAccountNumber,PurchaseOrderName,AccountingDate,PurchaseOrderStatus`;
    const hr = await fetch(hdrUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!hr.ok) continue;
    const hj: any = await hr.json();
    for (const h of hj.value || []) headers[h.PurchaseOrderNumber] = h;
  }

  const receipts: Receipt[] = lines.map((l) => {
    const h = headers[l.PurchaseOrderNumber] || {};
    const qty = Number(l.OrderedPurchaseQuantity || 0);
    const price = Number(l.PurchasePrice || 0);
    const dt = h.AccountingDate && h.AccountingDate !== "1900-01-01T12:00:00Z" ? h.AccountingDate : null;
    return {
      po_number: l.PurchaseOrderNumber,
      line_number: Number(l.LineNumber || 0),
      vendor_account: h.OrderVendorAccountNumber || null,
      vendor_name: h.PurchaseOrderName || null,
      qty,
      unit_price: price,
      total: qty * price,
      status: l.PurchaseOrderLineStatus || null,
      date: dt,
    };
  });

  // Sort newest first, only "real" receipts (Invoiced / Received). Keep
  // Confirmed/Backorder in a separate bucket so Abe can see open orders too.
  receipts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const received = receipts.filter((r) => r.status === "Invoiced" || r.status === "Received").slice(0, limit);
  const open = receipts.filter((r) => r.status !== "Invoiced" && r.status !== "Received").slice(0, 5);

  return NextResponse.json({ nsn, item_numbers: itemNumbers, receipts: received, open_orders: open });
}
