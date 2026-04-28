import { createServiceClient } from "@/lib/supabase-server";
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
  const initialRows = await getInitialRows(date);

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

      <PostBatchClient date={date} initialRows={initialRows as any} />
    </div>
  );
}
