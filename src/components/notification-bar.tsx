"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell, Bug, Lightbulb, CheckCircle, X, ExternalLink,
  MessageSquare, Image, Clock,
} from "lucide-react";

interface Comment {
  id: number;
  body: string;
  created_at: string;
  user: string;
  isScreenshot: boolean;
}

interface Notification {
  number: number;
  title: string;
  type: "bug" | "feature";
  priority: string;
  state: string;
  created_at: string;
  page: string | null;
  reporter: string;
  hasResponse: boolean;
  responsePreview: string;
  url: string;
  hasScreenshot: boolean;
  comments?: Comment[];
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
  const [open, setOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [issueDetail, setIssueDetail] = useState<Notification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchIssues() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setIssues(data.issues || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, 120000);
    function onBugSubmitted() { fetchIssues(); }
    window.addEventListener("bug-submitted", onBugSubmitted);
    return () => { clearInterval(interval); window.removeEventListener("bug-submitted", onBugSubmitted); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Load full issue detail with comments
  async function loadDetail(issueNumber: number) {
    setSelectedIssue(issueNumber);
    setDetailLoading(true);
    try {
      // Use the bugs API to get full comments (if admin), fallback to notifications
      const res = await fetch("/api/bugs");
      if (res.ok) {
        const data = await res.json();
        const issue = (data.issues || []).find((i: any) => i.number === issueNumber);
        if (issue) {
          setIssueDetail(issue);
          setDetailLoading(false);
          return;
        }
      }
    } catch {}
    // Fallback: use basic notification data
    const basic = issues.find(i => i.number === issueNumber);
    if (basic) setIssueDetail({ ...basic, comments: [] });
    setDetailLoading(false);
  }

  const openCount = issues.filter(i => i.state === "open").length;
  const unrespondedCount = issues.filter(i => i.state === "open" && !i.hasResponse).length;

  if (loading) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Bug Reports"
      >
        <Bell className={`h-5 w-5 ${openCount > 0 ? "text-amber-600" : "text-gray-400"}`} />
        {unrespondedCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unrespondedCount}
          </span>
        )}
        {openCount > 0 && unrespondedCount === 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {openCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-[420px] max-h-[80vh] bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-500" />
              <span className="text-sm font-bold">Bug Reports</span>
              <span className="text-xs text-gray-500">({issues.length} total)</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-200 rounded">
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>

          {selectedIssue && issueDetail ? (
            /* Detail View — full conversation */
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Back button + header */}
              <div className="px-3 py-2 border-b border-gray-100 bg-white shrink-0">
                <button onClick={() => { setSelectedIssue(null); setIssueDetail(null); }}
                  className="text-xs text-accent hover:text-accent-hover font-medium mb-1">
                  &larr; Back to all bugs
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    issueDetail.state === "open" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                  }`}>{issueDetail.state}</span>
                  <span className="text-xs font-bold">#{issueDetail.number}</span>
                  <span className="text-xs text-gray-700 truncate">{issueDetail.title}</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {issueDetail.reporter} · {timeAgo(issueDetail.created_at)}
                  {issueDetail.page && <span> · on {issueDetail.page}</span>}
                </div>
              </div>

              {/* Conversation thread */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {detailLoading ? (
                  <div className="text-center py-8 text-gray-400 text-xs">Loading conversation...</div>
                ) : (
                  <>
                    {/* Original report */}
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bug className="h-3 w-3 text-red-500" />
                        <span className="text-[10px] font-medium text-red-700">{issueDetail.reporter}</span>
                        <span className="text-[10px] text-red-400">{timeAgo(issueDetail.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-800">{issueDetail.title}</p>
                    </div>

                    {/* Comments */}
                    {(issueDetail as any).comments?.map((c: Comment) => (
                      <div key={c.id} className={`rounded-lg border p-2.5 ${
                        c.isScreenshot
                          ? "border-gray-200 bg-gray-50"
                          : c.body?.startsWith("**Fixed**")
                          ? "border-green-200 bg-green-50"
                          : "border-blue-200 bg-blue-50"
                      }`}>
                        {c.isScreenshot ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <Image className="h-3 w-3" />
                            <span>Screenshot attached</span>
                            <a href={issueDetail.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">view</a>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 mb-1">
                              <MessageSquare className="h-3 w-3 text-blue-500" />
                              <span className="text-[10px] font-medium text-gray-600">{c.user}</span>
                              <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                            </div>
                            <p className="text-xs text-gray-800 whitespace-pre-wrap">{c.body}</p>
                          </>
                        )}
                      </div>
                    ))}

                    {issueDetail.state === "closed" && (
                      <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span className="font-medium">Resolved</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer link */}
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 shrink-0">
                <a href={issueDetail.url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> View full thread on GitHub
                </a>
              </div>
            </div>
          ) : (
            /* List View — all bugs */
            <div className="flex-1 overflow-y-auto">
              {issues.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No bug reports yet</p>
                </div>
              ) : (
                issues.map((issue) => (
                  <button
                    key={issue.number}
                    onClick={() => loadDetail(issue.number)}
                    className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {issue.state === "closed" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : issue.hasResponse ? (
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Bug className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-500">#{issue.number}</span>
                          <span className={`text-[9px] px-1 rounded font-medium ${
                            issue.priority === "high" ? "bg-red-100 text-red-700" :
                            issue.priority === "low" ? "bg-gray-100 text-gray-500" :
                            "bg-amber-100 text-amber-700"
                          }`}>{issue.priority}</span>
                          {issue.state === "closed" && (
                            <span className="text-[9px] px-1 rounded bg-green-100 text-green-700">resolved</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-800 truncate mt-0.5">{issue.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span className="font-medium text-gray-500">{issue.reporter}</span>
                          <span>{timeAgo(issue.created_at)}</span>
                          {issue.page && <span>on {issue.page}</span>}
                        </div>
                        {issue.hasResponse && issue.responsePreview && (
                          <p className="text-[10px] text-green-600 mt-1 truncate">
                            &rarr; {issue.responsePreview.slice(0, 80)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
