import { createServiceClient } from "@/lib/supabase-server";
import { formatTime, formatDateTime } from "@/lib/dates";
import Link from "next/link";
import { ChevronLeft, DollarSign, Clock, Package } from "lucide-react";
import { TodayBidsTable } from "./today-bids-table";

async function getData() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Pull every bid from today, paginated. With 600+ bids/day this is
  // mandatory — the default 1K Supabase limit could clip it.
  const bids: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("abe_bids_live")
      .select("*")
      .gte("bid_time", today)
      .order("bid_time", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    bids.push(...data);
    if (data.length < 1000) break;
    page++;
    if (page >= 10) break; // safety
  }

  // Latest sync timestamp for the freshness label
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("created_at")
    .eq("action", "abe_bids_live_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { bids, lastSyncAt: lastSync?.created_at || null };
}

export default async function TodayBidsPage() {
  const { bids, lastSyncAt } = await getData();

  const totalValue = bids.reduce(
    (s, b) => s + (Number(b.bid_price) || 0) * (Number(b.bid_qty) || 1),
    0
  );
  const submitted = bids.filter((b) => b.bid_status === "submitted").length;
  const pending = bids.length - submitted;
  const fscCount = new Set(bids.map((b) => b.fsc).filter(Boolean)).size;

  return (
    <div className="p-4 md:p-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">Abe&apos;s Bids Today</h1>
        <p className="text-muted text-sm mt-1">
          Live from LamLinks. Synced every 5 min during business hours.
          {lastSyncAt && (
            <span> Last sync: {formatDateTime(lastSyncAt)} ET</span>
          )}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <DollarSign className="h-4 w-4" /> Total Bids
          </div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{bids.length}</div>
        </div>
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-xs text-green-700">
            <Package className="h-4 w-4" /> Submitted
          </div>
          <div className="text-3xl font-bold text-green-700 mt-1">{submitted}</div>
        </div>
        <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-2 text-xs text-yellow-700">
            <Clock className="h-4 w-4" /> Pending
          </div>
          <div className="text-3xl font-bold text-yellow-700 mt-1">{pending}</div>
        </div>
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
          <div className="text-xs text-purple-700">Total Value</div>
          <div className="text-3xl font-bold text-purple-700 mt-1">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-purple-600 mt-0.5">
            across {fscCount} FSC{fscCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {bids.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-muted">
          No bids recorded for today yet. Either Abe hasn&apos;t started or the
          5-min sync hasn&apos;t pulled them in yet.
        </div>
      ) : (
        <TodayBidsTable bids={bids} />
      )}
    </div>
  );
}
