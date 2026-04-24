"use client";
import { useEffect, useState } from "react";

type Receipt = {
  po_number: string;
  line_number: number;
  vendor_account: string | null;
  vendor_name: string | null;
  qty: number;
  unit_price: number;
  total: number;
  status: string | null;
  date: string | null;
};

type ApiResp = {
  nsn: string;
  receipts: Receipt[];
  open_orders?: Receipt[];
  reason?: string;
  error?: string;
};

export function AxRecentReceipts({ nsn }: { nsn: string }) {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/ax/recent-receipts?nsn=${encodeURIComponent(nsn)}&limit=10`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setErr(String(j.error));
        else setData(j);
      })
      .catch((e) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [nsn]);

  if (loading) {
    return (
      <div className="bg-blue-50/40 rounded-lg p-2 border border-blue-200 text-xs text-blue-700">
        Loading recent AX receipts…
      </div>
    );
  }
  if (err) {
    return (
      <div className="bg-red-50 rounded-lg p-2 border border-red-200 text-xs text-red-700">
        Couldn&apos;t reach AX: {err}
      </div>
    );
  }
  if (!data) return null;

  const receipts = data.receipts || [];
  const open = data.open_orders || [];
  if (receipts.length === 0 && open.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-2 border border-card-border text-[11px] text-muted">
        <span className="font-semibold text-gray-600">AX Receipts:</span> none —{" "}
        {data.reason || "no PO history for this NSN in AX."}
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200 text-xs">
      <div className="text-[10px] font-bold text-emerald-800 mb-1 flex items-center gap-2">
        <span>📦 Recent AX Receipts ({receipts.length})</span>
        <span className="text-[9px] font-normal text-emerald-700 italic">
          actual vendor + cost we paid
        </span>
      </div>
      <div className="rounded border border-emerald-200/80 bg-white overflow-hidden">
        <table className="w-full text-[11px]">
          <thead className="bg-emerald-50 text-emerald-900">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Date</th>
              <th className="px-2 py-1 text-left font-medium">Vendor</th>
              <th className="px-2 py-1 text-right font-medium">Qty</th>
              <th className="px-2 py-1 text-right font-medium">Unit $</th>
              <th className="px-2 py-1 text-right font-medium">Total</th>
              <th className="px-2 py-1 text-left font-medium">PO</th>
              <th className="px-2 py-1 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r, i) => (
              <tr key={i} className="border-t border-emerald-100">
                <td className="px-2 py-1 font-mono">{r.date ? r.date.slice(0, 10) : "—"}</td>
                <td className="px-2 py-1 truncate max-w-[200px]" title={r.vendor_name || ""}>
                  <span className="font-mono text-[10px] text-emerald-800">{r.vendor_account || "—"}</span>
                  {r.vendor_name && <span className="text-muted ml-1">{r.vendor_name}</span>}
                </td>
                <td className="px-2 py-1 text-right font-mono">{r.qty.toLocaleString()}</td>
                <td className="px-2 py-1 text-right font-mono font-semibold">${r.unit_price.toFixed(2)}</td>
                <td className="px-2 py-1 text-right font-mono">${r.total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td className="px-2 py-1 font-mono text-muted">{r.po_number}</td>
                <td className="px-2 py-1">
                  <span className={`px-1 rounded text-[9px] font-medium ${r.status === "Invoiced" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {r.status || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] font-bold text-amber-800 mb-1">⏳ Open Orders ({open.length})</div>
          <div className="rounded border border-amber-200 bg-white overflow-hidden">
            <table className="w-full text-[11px]">
              <tbody>
                {open.map((r, i) => (
                  <tr key={i} className="border-t border-amber-100">
                    <td className="px-2 py-1 font-mono">{r.date ? r.date.slice(0, 10) : "—"}</td>
                    <td className="px-2 py-1 truncate max-w-[200px]">
                      <span className="font-mono text-[10px]">{r.vendor_account || "—"}</span>
                      {r.vendor_name && <span className="text-muted ml-1">{r.vendor_name}</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{r.qty}</td>
                    <td className="px-2 py-1 text-right font-mono">${r.unit_price.toFixed(2)}</td>
                    <td className="px-2 py-1 font-mono text-muted">{r.po_number}</td>
                    <td className="px-2 py-1">
                      <span className="px-1 rounded text-[9px] font-medium bg-amber-100 text-amber-800">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
