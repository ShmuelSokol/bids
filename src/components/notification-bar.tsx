"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Bug, Lightbulb, CheckCircle, X, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

interface Notification {
  number: number;
  title: string;
  type: "bug" | "feature";
  priority: string;
  state: string;
  created_at: string;
  page: string | null;
  hasResponse: boolean;
  responsePreview: string;
  url: string;
  hasScreenshot: boolean;
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBar() {
  const [issues, setIssues] = useState<Notification[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIssues() {
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        setIssues(data.issues || []);
      } catch {}
      setLoading(false);
    }
    fetchIssues();

    // Poll every 2 minutes
    const interval = setInterval(fetchIssues, 120000);
    return () => clearInterval(interval);
  }, []);

  // Load dismissed from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("dismissed_notifications");
      if (stored) setDismissed(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  function dismiss(num: number) {
    const next = new Set(dismissed);
    next.add(num);
    setDismissed(next);
    sessionStorage.setItem("dismissed_notifications", JSON.stringify([...next]));
  }

  const visible = issues.filter((i) => !dismissed.has(i.number));
  const unresponded = visible.filter((i) => !i.hasResponse);

  if (loading || visible.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
      {/* Summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <span className="font-medium text-amber-800">
            {visible.length} open bug report{visible.length !== 1 ? "s" : ""}
            {unresponded.length > 0 && (
              <span className="text-red-600 ml-1">({unresponded.length} needs response)</span>
            )}
          </span>
          {!expanded && visible.slice(0, 2).map((i) => (
            <span key={i.number} className="text-amber-600 hidden md:inline">
              #{i.number}: {i.title.slice(0, 40)}{i.title.length > 40 ? "..." : ""}
            </span>
          ))}
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-amber-600" /> : <ChevronDown className="h-3.5 w-3.5 text-amber-600" />}
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {visible.map((issue) => (
            <div
              key={issue.number}
              className={`rounded-lg border p-3 text-xs ${
                issue.hasResponse
                  ? "bg-green-50 border-green-200"
                  : issue.priority === "high"
                  ? "bg-red-50 border-red-200"
                  : "bg-white border-amber-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  {issue.type === "bug" ? (
                    <Bug className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <Lightbulb className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">#{issue.number}</span>
                      <span className="text-gray-700">{issue.title}</span>
                      <span className={`px-1 rounded text-[9px] font-medium ${
                        issue.priority === "high" ? "bg-red-100 text-red-700" :
                        issue.priority === "low" ? "bg-gray-100 text-gray-600" :
                        "bg-amber-100 text-amber-700"
                      }`}>{issue.priority}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                      <span>{timeAgo(issue.created_at)}</span>
                      {issue.page && <span>on {issue.page}</span>}
                      {issue.hasScreenshot && <span>has screenshot</span>}
                    </div>
                    {issue.hasResponse && (
                      <div className="mt-1.5 flex items-start gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-green-700">{issue.responsePreview.slice(0, 150)}{issue.responsePreview.length > 150 ? "..." : ""}</span>
                      </div>
                    )}
                    {!issue.hasResponse && (
                      <div className="mt-1 text-red-600 font-medium">Awaiting response</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-gray-100 rounded"
                    title="View on GitHub"
                  >
                    <ExternalLink className="h-3 w-3 text-gray-400" />
                  </a>
                  <button
                    onClick={() => dismiss(issue.number)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Dismiss"
                  >
                    <X className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
