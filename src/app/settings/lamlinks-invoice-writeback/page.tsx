import { getSystemSetting } from "@/lib/system-settings";
import { InvoiceToggle } from "./toggle";
import Link from "next/link";

export default async function LamLinksInvoiceWritebackSettingsPage() {
  const live = (await getSystemSetting("lamlinks_invoice_writeback_enabled")) === "true";

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="text-xs text-muted mb-1">
          <Link href="/settings" className="hover:underline">← Settings</Link>
        </div>
        <h1 className="text-2xl font-bold">LamLinks Invoice Write-Back</h1>
        <p className="text-muted mt-1 text-sm">
          When LIVE, DIBS /invoicing posts draft invoices into LamLinks&apos; <code className="font-mono">kad_tab</code> + <code className="font-mono">kae_tab</code> so Abe doesn&apos;t click through the LamLinks desktop app. Unlike the bid write-back, these tables use SQL Server <code className="font-mono">IDENTITY</code> columns — id allocation is DB-native.
        </p>
      </div>

      <div className={`rounded-xl border-2 ${live ? "border-green-400 bg-green-50/50" : "border-amber-300 bg-amber-50/30"} p-6 mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold mb-1">
              {live ? (
                <span className="text-green-700">🟢 LIVE — invoices post to LamLinks</span>
              ) : (
                <span className="text-amber-700">⏳ PRE-LIVE — see checklist below before flipping</span>
              )}
            </div>
            <div className="text-xs text-muted leading-relaxed">
              When LIVE, clicking &quot;Post to LamLinks&quot; on <Link href="/invoicing" className="underline">/invoicing</Link> inserts a <code>kad_tab</code> header + one <code>kae_tab</code> line per ka9 row, then updates <code>ka9.idnkae_ka9</code> to link each job line to its invoice line. The invoice lands in LamLinks with <code>cinsta_kad=&apos;Not Posted&apos;</code> (draft) so Abe still has the UI Post step as a final human checkpoint.
            </div>
          </div>
          <InvoiceToggle initialValue={live} />
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-6 mb-6 text-sm">
        <h2 className="text-lg font-semibold mb-3">Preflight checklist (before flipping LIVE)</h2>
        <ul className="space-y-2 text-xs">
          <li className="flex gap-2">
            <span className="shrink-0">✅</span>
            <div><strong>Schema mapped.</strong> 20 columns on kad, 13 on kae, FK chain validated. See <Link href="/wiki/invoicing" className="underline">wiki</Link> for the field guide.</div>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">✅</span>
            <div><strong>Q1-Q5 answered from SQL</strong> (cinsta state machine, upname audit-only, idnk31 per-agency lookup, idnk06 default=1, ar_val_kad = mslval_kad). Re-run <code className="font-mono">scripts/answer-invoice-questions.ts</code> anytime to re-verify.</div>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">✅</span>
            <div><strong>Q6 resolved (Abe):</strong> AX never reads from LamLinks. No downstream integration to worry about — only the EDI-to-DIBBS transmission that LamLinks already handles internally on Post.</div>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">⏳</span>
            <div><strong>Q7 pending:</strong> watch LamLinks Post flow live via <code className="font-mono">scripts/tail-invoice-chain.ts</code> while Abe clicks Post on a real invoice. Confirms exact UPDATE sequence (cinsta flip, any side effects). See the morning test protocol in <Link href="/wiki/invoicing" className="underline">wiki/invoicing</Link>.</div>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">⏳</span>
            <div><strong>First live write dry-run.</strong> Pick one real un-invoiced shipment, run <code className="font-mono">scripts/test-invoice-writeback.ts --award-id=X</code>, verify the draft appears in LamLinks identical to one Abe would type. Then <code className="font-mono">--execute</code> with him watching.</div>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">⏳</span>
            <div><strong>Worker integration.</strong> Add invoice draining to <code className="font-mono">scripts/lamlinks-writeback-worker.ts</code> or a sibling worker. Same daemon process, new queue table. Only after the manual test above succeeds.</div>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-6 text-sm">
        <h2 className="text-lg font-semibold mb-3">Morning test protocol (2026-04-22)</h2>
        <ol className="space-y-2 text-xs list-decimal list-inside">
          <li>On NYEVRVSQL001, run <code className="font-mono">npx tsx scripts/tail-invoice-chain.ts</code> in one terminal. It polls kad/ka9/kae every 1 sec and prints new rows + column-level diffs.</li>
          <li>Have Abe Post ONE real invoice in LamLinks. We observe the exact write sequence — what fields change, in what order.</li>
          <li>Pick a different un-invoiced shipment. Run <code className="font-mono">scripts/test-invoice-writeback.ts --award-id=XXX</code> (dry run). Review the SQL with Abe.</li>
          <li>Run with <code className="font-mono">--execute</code>. Tail shows our writes. Abe confirms the draft appears in LamLinks &quot;Not Posted&quot; list identical to his own.</li>
          <li>Abe clicks Post on our draft. Tail shows the state flip. Celebrate.</li>
          <li>Flip the toggle above to LIVE and wire the /invoicing UI.</li>
        </ol>
      </div>
    </div>
  );
}
