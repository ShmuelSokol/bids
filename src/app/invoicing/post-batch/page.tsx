import { createServiceClient } from "@/lib/supabase-server";
import { getSystemSetting, getLamlinksWorkerHealth } from "@/lib/system-settings";
import Link from "next/link";
import { PostBatchClient } from "./post-batch-client";

export const dynamic = "force-dynamic";

async function getInitialRows(date: string) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("lamlinks_invoice_queue")
    .select("*")
    .eq("ax_invoice_date", date)
    .order("ax_invoice_number", { ascending: true });
  return data || [];
}

export default async function PostBatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || new Date().toISOString().slice(0, 10);
  const [initialRows, invoiceFlag, workerHealth] = await Promise.all([
    getInitialRows(date),
    getSystemSetting("lamlinks_invoice_writeback_enabled"),
    getLamlinksWorkerHealth(),
  ]);
  const invoiceWritebackLive = invoiceFlag === "true";

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <div className="text-xs text-muted mb-1">
          <Link href="/invoicing" className="hover:underline">← Invoicing</Link>
        </div>
        <h1 className="text-2xl font-bold">DD219 Invoice Batch — Post to LamLinks</h1>
        <p className="text-muted mt-1 text-sm">
          Replaces Abe&apos;s manual AX → Excel → LL retype loop.
          <strong className="ml-1">Two clicks:</strong> Import (pulls today&apos;s DD219 from AX) → Post All (worker writes kad/kae/k80/kbr to LL,
          fires WAWF 810 + 856 to DLA). Validated against the 2026-04-28 trace of CIN0066169.
        </p>
      </div>

      {!invoiceWritebackLive && (
        <div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm">
          <div className="font-bold text-amber-900">⏸ Invoice writeback is DISABLED</div>
          <div className="text-xs text-amber-800 mt-1">
            Import + queue review work, but the worker will NOT process approved rows until you flip the toggle on{" "}
            <Link href="/settings/lamlinks-invoice-writeback" className="underline">/settings/lamlinks-invoice-writeback</Link>.
          </div>
        </div>
      )}

      {!workerHealth.online && (
        <div className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-sm">
          <div className="font-bold text-red-900">🔴 Daemon is OFFLINE</div>
          <div className="text-xs text-red-800 mt-1">
            Last heartbeat {workerHealth.ageSeconds == null ? "never" : `${Math.round(workerHealth.ageSeconds / 60)} min ago`}.
            Approved rows will not be processed until the daemon is restarted on{" "}
            <code className="font-mono">{workerHealth.host || "the daemon host"}</code>.
          </div>
        </div>
      )}

      <PostBatchClient date={date} initialRows={initialRows as any} />
    </div>
  );
}
