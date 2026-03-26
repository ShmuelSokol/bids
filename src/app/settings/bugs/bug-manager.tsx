"use client";

import { useState, useEffect } from "react";
import {
  Bug, Lightbulb, CheckCircle, Clock, Send, X,
  ChevronLeft, ExternalLink, AlertTriangle, Loader2,
  XCircle, RotateCcw, Image,
} from "lucide-react";
import Link from "next/link";

interface Comment {
  id: number;
  body: string;
  created_at: string;
  user: string;
  isScreenshot: boolean;
}

interface Issue {
  number: number;
  title: string;
  body: string;
  state: string;
  created_at: string;
  updated_at: string;
  url: string;
  type: "bug" | "feature";
  priority: string;
  comments: Comment[];
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function parseBody(body: string) {
  const lines = body.split("\n").filter((l) => l.trim());
  const description = lines.find((l) => !l.startsWith("#") && !l.startsWith("**") && !l.startsWith("-") && l.length > 10) || "";
  const reporter = body.match(/\*\*Reporter:\*\*\s*(.+)/)?.[1] || "Anonymous";
  const page = body.match(/\*\*Page:\*\*\s*(https?:\/\/\S+)/)?.[1] || null;
  const screenSize = body.match(/\*\*Screen Size:\*\*\s*(\S+)/)?.[1] || null;
  const expected = body.match(/### Expected Behavior\n([\s\S]*?)(?=\n###|$)/)?.[1]?.trim() || null;
  return { description, reporter, page, screenSize, expected };
}

export function BugManager({ userName }: { userName: string }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");

  async function loadIssues() {
    try {
      const res = await fetch("/api/bugs");
      if (!res.ok) return;
      const data = await res.json();
      setIssues(data.issues || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadIssues();
    const interval = setInterval(loadIssues, 60000);
    return () => clearInterval(interval);
  }, []);

  async function sendReply(issueNumber: number) {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueNumber, comment: reply }),
      });
      setReply("");
      await loadIssues();
    } catch {}
    setSending(false);
  }

  async function closeIssue(issueNumber: number, comment?: string) {
    setSending(true);
    try {
      await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueNumber,
          comment: comment || "Resolved — closing ticket.",
          action: "close",
        }),
      });
      await loadIssues();
    } catch {}
    setSending(false);
  }

  async function reopenIssue(issueNumber: number) {
    setSending(true);
    try {
      await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueNumber, action: "reopen" }),
      });
      await loadIssues();
    } catch {}
    setSending(false);
  }

  const filtered = issues.filter((i) => {
    if (filter === "open") return i.state === "open";
    if (filter === "closed") return i.state === "closed";
    return true;
  });

  const selected = issues.find((i) => i.number === selectedId);
  const selectedParsed = selected ? parseBody(selected.body) : null;

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/settings" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Bug Management</span>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">Bug Management</h1>
        <p className="text-muted mt-1 text-sm">
          Review, respond, and resolve bug reports. Admin only.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4" style={{ minHeight: "70vh" }}>
        {/* Left: Issue List */}
        <div className="md:col-span-1 rounded-lg border border-card-border bg-card-bg overflow-hidden">
          <div className="px-3 py-2 border-b border-card-border bg-gray-50 flex items-center gap-2">
            <Bug className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold">Tickets ({filtered.length})</span>
            <div className="ml-auto flex gap-1">
              {(["open", "closed", "all"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${filter === f ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "65vh" }}>
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted text-xs">No {filter} tickets</div>
            ) : (
              filtered.map((issue) => {
                const textComments = issue.comments.filter((c) => !c.isScreenshot);
                const hasResponse = textComments.length > 0;
                return (
                  <button
                    key={issue.number}
                    onClick={() => setSelectedId(issue.number)}
                    className={`w-full text-left px-3 py-2.5 border-b border-card-border/50 hover:bg-blue-50/50 transition ${
                      selectedId === issue.number ? "bg-blue-50 border-l-2 border-l-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {issue.type === "bug" ? (
                        <Bug className="h-3 w-3 text-red-500 shrink-0" />
                      ) : (
                        <Lightbulb className="h-3 w-3 text-blue-500 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-gray-500">#{issue.number}</span>
                      <span className={`text-[9px] px-1 rounded font-medium ${
                        issue.priority === "high" ? "bg-red-100 text-red-700" :
                        issue.priority === "low" ? "bg-gray-100 text-gray-500" :
                        "bg-amber-100 text-amber-700"
                      }`}>{issue.priority}</span>
                      {issue.state === "closed" && (
                        <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700">closed</span>
                      )}
                      {!hasResponse && issue.state === "open" && (
                        <AlertTriangle className="h-3 w-3 text-red-400 ml-auto shrink-0" />
                      )}
                      {hasResponse && <CheckCircle className="h-3 w-3 text-green-500 ml-auto shrink-0" />}
                    </div>
                    <div className="text-xs mt-0.5 truncate">{issue.title}</div>
                    <div className="text-[10px] text-muted mt-0.5">{timeAgo(issue.created_at)}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Issue Detail + Conversation */}
        <div className="md:col-span-2 rounded-lg border border-card-border bg-card-bg overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
              <div className="text-center">
                <Bug className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Select a ticket to view details</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-card-border bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold">#{selected.number}: {selected.title}</h2>
                    <div className="flex items-center gap-3 text-[10px] text-muted mt-0.5">
                      <span>by {selectedParsed?.reporter}</span>
                      <span>{timeAgo(selected.created_at)}</span>
                      {selectedParsed?.page && (
                        <span>on <span className="font-mono">{new URL(selectedParsed.page).pathname}</span></span>
                      )}
                      {selectedParsed?.screenSize && <span>{selectedParsed.screenSize}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <a href={selected.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                      <ExternalLink className="h-3 w-3 inline mr-1" />GitHub
                    </a>
                    {selected.state === "open" ? (
                      <button onClick={() => closeIssue(selected.number)} disabled={sending}
                        className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50">
                        <XCircle className="h-3 w-3 inline mr-1" />Close
                      </button>
                    ) : (
                      <button onClick={() => reopenIssue(selected.number)} disabled={sending}
                        className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50">
                        <RotateCcw className="h-3 w-3 inline mr-1" />Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "50vh" }}>
                {/* Original report */}
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-[10px] text-red-600 font-medium mb-1">Bug Report</div>
                  <p className="text-xs text-gray-800">{selectedParsed?.description}</p>
                  {selectedParsed?.expected && (
                    <p className="text-xs text-gray-600 mt-2"><strong>Expected:</strong> {selectedParsed.expected}</p>
                  )}
                </div>

                {/* Comments */}
                {selected.comments.map((c) => (
                  <div key={c.id} className={`rounded-lg border p-3 ${
                    c.isScreenshot
                      ? "border-gray-200 bg-gray-50"
                      : c.user === "ShmuelSokol"
                      ? "border-blue-200 bg-blue-50"
                      : "border-green-200 bg-green-50"
                  }`}>
                    {c.isScreenshot ? (
                      <div className="text-center">
                        <Image className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                        <span className="text-[10px] text-gray-500">Screenshot attached — <a href={selected.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">view on GitHub</a></span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-gray-600">{c.user}</span>
                          <span className="text-[10px] text-muted">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-800 whitespace-pre-wrap">{c.body}</p>
                      </>
                    )}
                  </div>
                ))}

                {selected.state === "closed" && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center">
                    <CheckCircle className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                    <span className="text-xs text-purple-700 font-medium">Ticket closed</span>
                  </div>
                )}
              </div>

              {/* Reply box */}
              {selected.state === "open" && (
                <div className="px-4 py-3 border-t border-card-border bg-gray-50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(selected.number); } }}
                      placeholder={`Reply as ${userName}...`}
                      className="flex-1 rounded-lg border border-card-border px-3 py-2 text-xs"
                    />
                    <button
                      onClick={() => sendReply(selected.number)}
                      disabled={sending || !reply.trim()}
                      className="flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-xs text-white font-medium hover:bg-accent-hover disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Send
                    </button>
                    <button
                      onClick={() => closeIssue(selected.number, reply.trim() || "Fixed — closing ticket.")}
                      disabled={sending}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs text-white font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Resolve
                    </button>
                  </div>
                  <p className="text-[9px] text-muted mt-1">
                    Enter to send. "Resolve" posts your message and closes the ticket. Claude monitors every 5 min and will analyze new bugs automatically.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
