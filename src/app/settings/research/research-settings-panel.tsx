"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Save, Activity, DollarSign, Search, AlertCircle } from "lucide-react";
import { formatDateShort, formatDateTime } from "@/lib/dates";

interface Setting {
  key: string;
  value: string;
  description: string | null;
}
interface DaySpend {
  date: string;
  total_usd: number;
  call_count: number;
}

export function ResearchSettingsPanel({
  settings,
  today_spend,
  week_spend,
  queued,
  researched,
  failed,
}: {
  settings: Setting[];
  today_spend: DaySpend;
  week_spend: DaySpend[];
  queued: number;
  researched: number;
  failed: number;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  async function save(key: string) {
    setSaving(key);
    try {
      const r = await fetch("/api/research/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] }),
      });
      if (r.ok) {
        setSaved((prev) => new Set([...prev, key]));
        setTimeout(() => setSaved((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        }), 2000);
      } else {
        const err = await r.json();
        alert(`Failed: ${err.error || r.status}`);
      }
    } finally {
      setSaving(null);
    }
  }

  const budget = Number(values.daily_budget_usd || "20");
  const pct = Math.min(100, Math.round((today_spend.total_usd / budget) * 100));

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/settings" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Research</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Auto-Research Settings</h1>
        <p className="text-muted text-sm mt-1 max-w-2xl">
          Controls for the Claude-powered NSN supplier-research pipeline. Changes take effect on the next research-worker
          pass (every 30–60s). Admin only.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <div className={`rounded-lg border-2 p-3 ${pct >= 90 ? "border-red-300 bg-red-50" : pct >= 50 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
          <div className="text-xs text-muted flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Today's spend
          </div>
          <div className="text-2xl font-bold">${today_spend.total_usd.toFixed(2)}</div>
          <div className="text-[10px] text-muted">
            of ${budget.toFixed(0)} budget · {today_spend.call_count} calls · {pct}%
          </div>
          <div className="mt-1 bg-white/50 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full ${pct >= 90 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-green-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs text-muted flex items-center gap-1">
            <Activity className="h-3 w-3" /> In queue
          </div>
          <div className="text-2xl font-bold text-blue-700">{queued.toLocaleString()}</div>
          <div className="text-[10px] text-muted">NSNs waiting for research</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-xs text-muted flex items-center gap-1">
            <Search className="h-3 w-3" /> Researched
          </div>
          <div className="text-2xl font-bold text-green-700">{researched.toLocaleString()}</div>
          <div className="text-[10px] text-muted">NSNs with cached results</div>
        </div>
        <div className={`rounded-lg border p-3 ${failed > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
          <div className="text-xs text-muted flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Failed
          </div>
          <div className={`text-2xl font-bold ${failed > 0 ? "text-red-700" : "text-gray-500"}`}>{failed.toLocaleString()}</div>
          <div className="text-[10px] text-muted">retry or investigate</div>
        </div>
      </div>

      {/* Last 7 days spend chart (text table) */}
      {week_spend.length > 0 && (
        <div className="rounded-lg border border-card-border bg-card-bg p-3 mb-6">
          <div className="text-xs font-semibold mb-2">Last 7 days of spend</div>
          <table className="w-full text-xs">
            <tbody>
              {week_spend.map((d) => (
                <tr key={d.date} className="border-b border-card-border/40">
                  <td className="py-1 text-muted">{d.date}</td>
                  <td className="py-1 text-right font-mono">${Number(d.total_usd).toFixed(2)}</td>
                  <td className="py-1 text-right text-muted">{d.call_count} calls</td>
                  <td className="py-1 pl-3">
                    <div className="bg-gray-100 rounded-full h-1.5 w-32 overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${Math.min(100, (Number(d.total_usd) / budget) * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Settings form */}
      <div className="rounded-lg border border-card-border bg-card-bg">
        <div className="px-4 py-2 border-b border-card-border">
          <h2 className="text-sm font-semibold">Configuration</h2>
        </div>
        <div className="divide-y divide-card-border">
          {settings.map((s) => (
            <div key={s.key} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1">
                <label className="text-xs font-mono font-semibold">{s.key}</label>
                {s.description && <p className="text-[11px] text-muted mt-0.5">{s.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={values[s.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                  className="text-xs font-mono rounded border border-card-border px-2 py-1 w-44"
                />
                <button
                  onClick={() => save(s.key)}
                  disabled={saving === s.key || values[s.key] === s.value}
                  className={`text-xs rounded px-2 py-1 inline-flex items-center gap-1 ${
                    saved.has(s.key)
                      ? "bg-green-100 text-green-700"
                      : values[s.key] === s.value
                      ? "bg-gray-100 text-gray-400 cursor-default"
                      : "bg-accent text-white hover:opacity-90"
                  }`}
                >
                  {saving === s.key ? "…" : saved.has(s.key) ? "Saved" : <><Save className="h-3 w-3" /> Save</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-[10px] text-muted">
        Note: ANTHROPIC_API_KEY must be set in .env for research to run. Without it the worker logs a clean error and pauses.
      </div>
    </>
  );
}
