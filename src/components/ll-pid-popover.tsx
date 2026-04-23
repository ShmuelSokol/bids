"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, X } from "lucide-react";

/**
 * Inline badge that, when clicked, fetches and displays the Procurement
 * Item Description + Contract Packaging Requirements for a given NSN.
 *
 * Use anywhere we render an NSN — the badge stays dim until hovered,
 * and only fetches on click (cheap).
 */
interface Props {
  nsn: string | null | undefined;
  compact?: boolean;
}

type PidData = {
  found: boolean;
  fsc?: string;
  niin?: string;
  pid_text?: string | null;
  packaging_text?: string | null;
  packaging_notes?: string | null;
  last_award_date?: string | null;
};

export function LlPidPopover({ nsn, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PidData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data || !nsn) return;
    setLoading(true);
    fetch(`/api/ll-pid/${encodeURIComponent(nsn)}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ found: false }))
      .finally(() => setLoading(false));
  }, [open, data, nsn]);

  if (!nsn) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 text-[10px] rounded border border-card-border px-1.5 py-0.5 hover:bg-gray-50 ${compact ? "" : "ml-2"}`}
        title="View Procurement Item Description from LamLinks"
      >
        <FileText className="h-3 w-3" />
        {!compact && <span>PID</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Procurement Item Description</div>
                <div className="text-xs text-muted font-mono">{nsn}</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading from LamLinks…
                </div>
              )}
              {!loading && data && !data.found && (
                <div className="text-sm text-muted">
                  No PID recorded for this NSN. ERG hasn&apos;t been awarded this item in the last 3 years —
                  DLA only attaches PID text after award.
                </div>
              )}
              {!loading && data?.found && (
                <div className="space-y-4 text-sm">
                  {data.last_award_date && (
                    <div className="text-[11px] text-muted">
                      Last awarded {new Date(data.last_award_date).toLocaleDateString()}
                    </div>
                  )}
                  {data.pid_text && (
                    <section>
                      <h3 className="text-xs font-semibold uppercase text-muted mb-1">PID</h3>
                      <pre className="whitespace-pre-wrap font-mono text-[11px] bg-gray-50 rounded p-3 border border-card-border">
                        {data.pid_text}
                      </pre>
                    </section>
                  )}
                  {data.packaging_text && (
                    <section>
                      <h3 className="text-xs font-semibold uppercase text-muted mb-1">Packaging Requirements</h3>
                      <pre className="whitespace-pre-wrap font-mono text-[11px] bg-gray-50 rounded p-3 border border-card-border">
                        {data.packaging_text}
                      </pre>
                    </section>
                  )}
                  {data.packaging_notes && (
                    <section>
                      <h3 className="text-xs font-semibold uppercase text-muted mb-1">Packaging Notes</h3>
                      <pre className="whitespace-pre-wrap font-mono text-[11px] bg-gray-50 rounded p-3 border border-card-border">
                        {data.packaging_notes}
                      </pre>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
