"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      router.push("/");
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-white font-bold text-2xl mb-4">
            D
          </div>
          <h1 className="text-2xl font-bold">DIBS</h1>
          <p className="text-muted mt-1">Government Bidding System</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm"
              placeholder="Enter username"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-xs text-muted text-center">
            CAGE Code: 0AG09 / ERG Supply
          </p>
        </form>
      </div>
    </div>
  );
}
