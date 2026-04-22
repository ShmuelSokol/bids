"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Shield, User as UserIcon, Users, Check } from "lucide-react";

type U = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  must_reset_password: boolean;
  last_seen_at: string | null;
};

const ROLES = [
  { value: "superadmin", label: "Superadmin", hint: "Full access + can manage users" },
  { value: "admin", label: "Admin", hint: "Full app access" },
  { value: "manager", label: "Manager", hint: "Bid + order decisions" },
  { value: "viewer", label: "Viewer", hint: "Read-only" },
];

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-800 border-purple-300",
  admin: "bg-blue-100 text-blue-800 border-blue-300",
  manager: "bg-green-100 text-green-800 border-green-300",
  viewer: "bg-gray-100 text-gray-700 border-gray-300",
};

// Turn an ISO timestamp into "just now / 5 sec ago / 3 min ago / 2 hr ago / 3d ago".
// Re-rendered every second via a state bump so the value ticks live.
function relativeTime(iso: string | null, nowMs: number): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr !== 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function onlineColor(iso: string | null, nowMs: number): string {
  if (!iso) return "text-muted";
  const sec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (sec < 120) return "text-green-600 font-medium";         // <2 min — online now
  if (sec < 900) return "text-amber-600";                     // <15 min — recent
  if (sec < 3600 * 24) return "text-muted";
  return "text-muted/60";
}

export function UsersManager() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [changing, setChanging] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUsers(data.users || []);
      setCurrentUserId(data.current_user_id || null);
      setErr(null);
      lastRefreshRef.current = Date.now();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }, []);

  // Initial load + poll every 15 s (server round-trip for data + last_seen).
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Tick every second so the "X sec ago" labels update live without hitting
  // the server for every frame.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  async function setRole(u: U, newRole: string) {
    if (newRole === u.role) return;
    setChanging((c) => ({ ...c, [u.id]: true }));
    setMsg(null);
    try {
      const res = await fetch("/api/users/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setUsers((prev) => prev?.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)) || null);
      setMsg(`${u.full_name || u.email}: ${data.old_role} → ${newRole}`);
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setErr(e.message || String(e));
      setTimeout(() => setErr(null), 5000);
    } finally {
      setChanging((c) => ({ ...c, [u.id]: false }));
    }
  }

  const sortedUsers = useMemo(() => {
    if (!users) return null;
    return [...users].sort((a, b) => {
      const at = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      const bt = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      return bt - at; // most recent first
    });
  }, [users]);

  const refreshedAgo = Math.floor((nowMs - lastRefreshRef.current) / 1000);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 text-sm">
        <Users className="h-4 w-4 text-muted" />
        <div className="text-muted">
          {users ? `${users.length} user${users.length !== 1 ? "s" : ""}` : "—"}
        </div>
        <div className="flex-1" />
        {lastRefreshRef.current > 0 && (
          <span className="text-xs text-muted">
            Refreshed {refreshedAgo < 2 ? "just now" : `${refreshedAgo}s ago`}
          </span>
        )}
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1 text-xs rounded border border-card-border px-2 py-1 hover:bg-gray-50"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {err && <div className="mb-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm p-3">{err}</div>}
      {msg && <div className="mb-3 rounded border border-green-300 bg-green-50 text-green-800 text-sm p-3 inline-flex items-center gap-1"><Check className="h-4 w-4" />{msg}</div>}

      {/* Table */}
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-muted text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Last online</th>
              <th className="px-4 py-2.5 font-medium">Member since</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!sortedUsers ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading...
                </td>
              </tr>
            ) : sortedUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">No users.</td>
              </tr>
            ) : sortedUsers.map((u) => {
              const isMe = u.id === currentUserId;
              const badge = ROLE_BADGE[u.role] || ROLE_BADGE.viewer;
              return (
                <tr key={u.id} className="border-t border-card-border hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-accent/10 text-accent inline-flex items-center justify-center text-xs font-semibold">
                        {(u.full_name || u.email)[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium inline-flex items-center gap-1.5">
                          {u.full_name || u.email}
                          {isMe && <span className="text-[10px] rounded bg-blue-100 text-blue-700 px-1 py-0.5">you</span>}
                          {u.must_reset_password && <span className="text-[10px] rounded bg-amber-100 text-amber-800 px-1 py-0.5">must reset pw</span>}
                        </div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded border px-2 py-0.5 ${badge}`}>
                      {u.role === "superadmin" && <Shield className="h-3 w-3" />}
                      {u.role === "admin" && <Shield className="h-3 w-3" />}
                      {u.role === "manager" && <UserIcon className="h-3 w-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 ${onlineColor(u.last_seen_at, nowMs)}`}>
                    {relativeTime(u.last_seen_at, nowMs)}
                  </td>
                  <td className="px-4 py-2.5 text-muted text-xs">
                    {new Date(u.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-2">
                      <select
                        value={u.role}
                        disabled={isMe || changing[u.id]}
                        onChange={(e) => setRole(u, e.target.value)}
                        className="rounded border border-card-border bg-white px-2 py-1 text-xs disabled:opacity-50"
                        title={isMe ? "Use another superadmin to change your own role" : ""}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      {changing[u.id] && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 text-xs text-muted">
        <div className="font-medium mb-1">Role reference</div>
        <ul className="space-y-0.5">
          {ROLES.map((r) => (
            <li key={r.value}>
              <span className={`inline-block rounded border px-1.5 py-0.5 mr-1.5 text-[10px] font-medium ${ROLE_BADGE[r.value]}`}>{r.label}</span>
              {r.hint}
            </li>
          ))}
        </ul>
        <div className="mt-2 leading-snug">
          "Last online" is derived from the user's most recent `user_activity` row — any authenticated action (page view, bid action, etc.) updates it.
          Table auto-refreshes every 15 s; relative timestamps tick live every second.
        </div>
      </div>
    </div>
  );
}
