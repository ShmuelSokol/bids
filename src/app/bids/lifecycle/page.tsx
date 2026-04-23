import { createServiceClient } from "@/lib/supabase-server";
import { BidLifecycleTable } from "./bid-lifecycle-table";

export const dynamic = "force-dynamic";

async function getData() {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Abe's recent bids (last 30 days)
  const { data: bids } = await sb
    .from("abe_bids_live")
    .select("bid_id, solicitation_number, nsn, bid_price, bid_qty, bid_time, lead_days, fob, bid_status")
    .gte("bid_time", since)
    .order("bid_time", { ascending: false })
    .limit(500);

  const solNos = Array.from(new Set((bids || []).map((b) => b.solicitation_number).filter(Boolean)));

  // Awards for these sols (paginate to avoid 1K cap; we'll rarely hit it but defend it)
  let awardsBySol = new Map<string, any>();
  if (solNos.length > 0) {
    for (let i = 0; i < solNos.length; i += 200) {
      const chunk = solNos.slice(i, i + 200);
      const { data } = await sb
        .from("awards")
        .select("contract_number, solicitation_number, unit_price, quantity, award_date, cage")
        .in("solicitation_number", chunk);
      for (const a of data || []) {
        if (!a.solicitation_number) continue;
        // keep most recent award per sol; prefer 0AG09 (our win) if multiple
        const key = a.solicitation_number;
        const existing = awardsBySol.get(key);
        const isUs = (a.cage || "").trim() === "0AG09";
        if (!existing || isUs || new Date(a.award_date) > new Date(existing.award_date)) {
          awardsBySol.set(key, a);
        }
      }
    }
  }

  const contractNos = Array.from(new Set([...awardsBySol.values()].map((a) => a.contract_number).filter(Boolean)));

  // Shipments for these contracts
  let shipmentsByContract = new Map<string, any[]>();
  if (contractNos.length > 0) {
    for (let i = 0; i < contractNos.length; i += 200) {
      const chunk = contractNos.slice(i, i + 200);
      const { data } = await sb
        .from("ll_shipments")
        .select("idnkaj, ship_number, contract_number, ship_status, ship_date, sell_value, quantity")
        .in("contract_number", chunk);
      for (const s of data || []) {
        if (!s.contract_number) continue;
        if (!shipmentsByContract.has(s.contract_number)) shipmentsByContract.set(s.contract_number, []);
        shipmentsByContract.get(s.contract_number)!.push(s);
      }
    }
  }

  // EDI for those shipments
  const allKajIds = Array.from(
    new Set(
      [...shipmentsByContract.values()]
        .flat()
        .map((s) => s.idnkaj)
        .filter((v) => v != null)
    )
  );
  const ediByKaj = new Map<number, any[]>();
  if (allKajIds.length > 0) {
    for (let i = 0; i < allKajIds.length; i += 200) {
      const chunk = allKajIds.slice(i, i + 200);
      const { data } = await sb
        .from("ll_edi_transmissions")
        .select("parent_id, edi_type, lifecycle, status, transmitted_at")
        .eq("parent_table", "kaj")
        .in("parent_id", chunk)
        .order("transmitted_at", { ascending: false });
      for (const e of data || []) {
        const k = Number(e.parent_id);
        if (!ediByKaj.has(k)) ediByKaj.set(k, []);
        ediByKaj.get(k)!.push(e);
      }
    }
  }

  return {
    bids: bids || [],
    awardsBySol: Object.fromEntries(awardsBySol),
    shipmentsByContract: Object.fromEntries(shipmentsByContract),
    ediByKaj: Object.fromEntries(ediByKaj),
  };
}

export default async function BidLifecyclePage() {
  const data = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <BidLifecycleTable {...data} />
    </div>
  );
}
