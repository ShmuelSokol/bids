"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { fscLabel, fscName } from "@/lib/fsc-names";

type Opt = { code: string; count: number };

/**
 * Searchable FSC filter combobox.
 *   - Shows "<code> · <name> (count)"
 *   - Default sort: count DESC (Abe's biggest categories bubble up)
 *   - Toggle sort to alphabetical
 *   - Typeahead matches code OR name OR name prefix
 *   - Empty input resets to "all"
 */
export function FscFilter({
  value,
  options,
  onChange,
  placeholder = "All FSCs",
}: {
  value: string; // "all" or an FSC code
  options: Opt[]; // distinct FSC codes + counts in the current dataset
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"count" | "code">("count");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let list = options.filter((o) => {
      if (!qq) return true;
      if (o.code.toLowerCase().includes(qq)) return true;
      const name = fscName(o.code).toLowerCase();
      return name.includes(qq);
    });
    if (sortBy === "count") list = [...list].sort((a, b) => b.count - a.count);
    else list = [...list].sort((a, b) => a.code.localeCompare(b.code));
    return list.slice(0, 80);
  }, [options, q, sortBy]);

  const current =
    value === "all" ? placeholder : fscLabel(value);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded border border-card-border bg-white px-2 py-1 text-[11px] min-w-[170px] justify-between hover:bg-gray-50"
      >
        <span className={`truncate ${value === "all" ? "text-muted" : "font-medium"}`}>{current}</span>
        {value !== "all" ? (
          <X
            className="h-3 w-3 text-muted hover:text-red-500"
            onClick={(e) => { e.stopPropagation(); onChange("all"); }}
          />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted" />
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[340px] rounded-lg border border-card-border bg-white shadow-lg">
          <div className="p-2 border-b border-card-border flex items-center gap-2">
            <Search className="h-3 w-3 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search FSC code or name…"
              className="flex-1 rounded border border-card-border px-2 py-1 text-xs"
            />
            <button
              onClick={() => setSortBy((s) => (s === "count" ? "code" : "count"))}
              className="text-[10px] text-muted hover:text-accent"
              title="Toggle sort"
            >
              {sortBy === "count" ? "by count ↓" : "by code A-Z"}
            </button>
          </div>
          <div className="max-h-[280px] overflow-y-auto text-xs">
            <button
              onClick={() => { onChange("all"); setOpen(false); setQ(""); }}
              className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 ${value === "all" ? "bg-accent/5 font-medium" : ""}`}
            >
              All FSCs <span className="text-muted">· no filter</span>
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-muted italic">No FSCs match "{q}"</div>
            ) : (
              filtered.map((o) => {
                const active = value === o.code;
                return (
                  <button
                    key={o.code}
                    onClick={() => { onChange(o.code); setOpen(false); setQ(""); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 border-t border-card-border/30 flex items-center justify-between ${active ? "bg-accent/10 font-medium" : ""}`}
                  >
                    <span>
                      <span className="font-mono font-semibold">{o.code}</span>
                      <span className="text-muted"> · {fscName(o.code).replace(`FSC ${o.code}`, "(unnamed)")}</span>
                    </span>
                    <span className="text-[10px] rounded bg-gray-100 text-gray-700 px-1.5 font-semibold">{o.count}</span>
                  </button>
                );
              })
            )}
          </div>
          {filtered.length === 80 && (
            <div className="px-3 py-1 text-[10px] text-muted text-center border-t border-card-border">Showing top 80 — refine your search to see more</div>
          )}
        </div>
      )}
    </div>
  );
}
