"use client";

import { useState, useMemo } from "react";
import {
  User, LogIn, LogOut, Zap, DollarSign, Send, X, Search,
  RefreshCw, Package, Eye, Clock, Filter, ChevronLeft,
} from "lucide-react";
import Link from "next/link";

interface Activity {
  id: number;
  user_id: string | null;
  user_name: string | null;
  event_type: string;
  event_action: string;
  page: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface ActiveUser {
  name: string;
  actions: number;
  lastSeen: string;
  types: string[];
}

const EVENT_ICONS: Record<string, { icon: typeof Zap; color: string; bg: string }> = {
  "auth:login": { icon: LogIn, color: "text-green-700", bg: "bg-green-100" },
  "auth:logout": { icon: LogOut, color: "text-gray-600", bg: "bg-gray-100" },
  "auth:login_failed": { icon: X, color: "text-red-700", bg: "bg-red-100" },
  "bid:quoted": { icon: DollarSign, color: "text-blue-700", bg: "bg-blue-100" },
  "bid:skipped": { icon: X, color: "text-gray-600", bg: "bg-gray-100" },
  "bid:submitted": { icon: Send, color: "text-purple-700", bg: "bg-purple-100" },
  "order:po_created": { icon: Package, color: "text-indigo-700", bg: "bg-indigo-100" },
  "sync:scrape": { icon: RefreshCw, color: "text-cyan-700", bg: "bg-cyan-100" },
  "sync:enrich": { icon: Zap, color: "text-teal-700", bg: "bg-teal-100" },
  "search:supplier_search": { icon: Search, color: "text-orange-700", bg: "bg-orange-100" },
  "page_view:view": { icon: Eye, color: "text-gray-500", bg: "bg-gray-50" },
};

function getEventConfig(type: string, action: string) {
  return EVENT_ICONS[`${type}:${action}`] || { icon: Zap, color: "text-gray-600", bg: "bg-gray-100" };
}

function formatAction(a: Activity): string {
  const d = a.details as Record<string, string | number>;
  switch (`${a.event_type}:${a.event_action}`) {
    case "auth:login": return `logged in`;
    case "auth:logout": return `logged out`;
    case "auth:login_failed": return `failed login attempt (${d.email || "unknown"})`;
    case "bid:quoted": return `quoted ${d.solicitation_number || "?"} @ $${d.final_price || d.suggested_price || "?"}`;
    case "bid:skipped": return `skipped ${d.solicitation_number || "?"}`;
    case "bid:submitted": return `submitted bid for ${d.solicitation_number || "?"}`;
    case "order:po_created": return `generated ${d.po_count || "?"} POs (${d.line_count || "?"} lines)`;
    case "sync:scrape": return `synced DIBBS data`;
    case "sync:enrich": return `enriched solicitations`;
    case "search:supplier_search": return `searched suppliers for ${d.nsn || "?"}`;
    case "page_view:view": return `viewed ${a.page || "/"}`;
    default: return `${a.event_action}`;
  }
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ActivityFeed({
  initialActivity,
  activeUsers,
}: {
  initialActivity: Activity[];
  activeUsers: ActiveUser[];
}) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [showPageViews, setShowPageViews] = useState(false);

  const users = useMemo(() => {
    const set = new Set<string>();
    for (const a of initialActivity) {
      if (a.user_name) set.add(a.user_name);
    }
    return Array.from(set).sort();
  }, [initialActivity]);

  const filtered = useMemo(() => {
    return initialActivity.filter((a) => {
      if (!showPageViews && a.event_type === "page_view") return false;
      if (typeFilter !== "all" && a.event_type !== typeFilter) return false;
      if (userFilter !== "all" && a.user_name !== userFilter) return false;
      return true;
    });
  }, [initialActivity, typeFilter, userFilter, showPageViews]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of filtered) {
      const day = new Date(a.created_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Quick stats
  const stats = useMemo(() => {
    const today = new Date(new Date().toDateString()).toISOString();
    const todayEvents = initialActivity.filter((a) => a.created_at >= today);
    return {
      totalToday: todayEvents.filter((a) => a.event_type !== "page_view").length,
      bidsToday: todayEvents.filter((a) => a.event_type === "bid").length,
      loginsToday: todayEvents.filter((a) => a.event_type === "auth" && a.event_action === "login").length,
      pageViewsToday: todayEvents.filter((a) => a.event_type === "page_view").length,
    };
  }, [initialActivity]);

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/settings" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Activity</span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-card-border bg-card-bg p-3">
          <div className="text-2xl font-bold">{stats.totalToday}</div>
          <div className="text-xs text-muted">Actions Today</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-2xl font-bold text-blue-700">{stats.bidsToday}</div>
          <div className="text-xs text-muted">Bids Today</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-2xl font-bold text-green-700">{stats.loginsToday}</div>
          <div className="text-xs text-muted">Logins Today</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-2xl font-bold text-gray-600">{stats.pageViewsToday}</div>
          <div className="text-xs text-muted">Page Views Today</div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {/* Left: Active Users Panel */}
        <div className="md:col-span-1">
          <div className="rounded-lg border border-card-border bg-card-bg p-3 mb-4">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
              <User className="h-4 w-4" /> Active Today
            </h3>
            {activeUsers.length === 0 ? (
              <p className="text-xs text-muted">No activity yet today</p>
            ) : (
              <div className="space-y-2">
                {activeUsers.map((u) => (
                  <button
                    key={u.name}
                    onClick={() => setUserFilter(userFilter === u.name ? "all" : u.name)}
                    className={`w-full text-left rounded-lg p-2 text-xs transition ${
                      userFilter === u.name ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      {u.name}
                    </div>
                    <div className="text-muted mt-0.5">
                      {u.actions} actions · {timeAgo(u.lastSeen)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="rounded-lg border border-card-border bg-card-bg p-3">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
              <Filter className="h-4 w-4" /> Filters
            </h3>
            <div className="space-y-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full text-xs rounded border border-card-border px-2 py-1.5"
              >
                <option value="all">All Event Types</option>
                <option value="auth">Auth (Login/Logout)</option>
                <option value="bid">Bids</option>
                <option value="order">Orders/POs</option>
                <option value="sync">Sync</option>
                <option value="search">Searches</option>
                <option value="page_view">Page Views</option>
              </select>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full text-xs rounded border border-card-border px-2 py-1.5"
              >
                <option value="all">All Users</option>
                {users.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPageViews}
                  onChange={(e) => setShowPageViews(e.target.checked)}
                  className="rounded"
                />
                Show page views
              </label>
            </div>
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="md:col-span-3">
          <div className="rounded-lg border border-card-border bg-card-bg">
            {grouped.length === 0 ? (
              <div className="p-8 text-center text-muted">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity recorded yet</p>
                <p className="text-xs mt-1">Activity will appear here as users interact with the system</p>
              </div>
            ) : (
              grouped.map(([day, events]) => (
                <div key={day}>
                  <div className="sticky top-0 bg-card-bg border-b border-card-border px-4 py-2">
                    <h3 className="text-xs font-bold text-muted">{day}</h3>
                  </div>
                  {events.map((a) => {
                    const config = getEventConfig(a.event_type, a.event_action);
                    const Icon = config.icon;
                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 px-4 py-2.5 border-b border-card-border/50 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className={`mt-0.5 rounded-full p-1.5 ${config.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">
                            <span className="font-medium">
                              {a.user_name || "System"}
                            </span>{" "}
                            <span className="text-muted">
                              {formatAction(a)}
                            </span>
                          </div>
                          {a.page && a.event_type !== "page_view" && (
                            <div className="text-[10px] text-muted mt-0.5">
                              on {a.page}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-muted whitespace-nowrap">
                          {new Date(a.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="text-center text-xs text-muted mt-2">
            Showing {filtered.length} events from the last 7 days
          </div>
        </div>
      </div>
    </>
  );
}
