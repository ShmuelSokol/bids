"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Landing page for Supabase password-reset links.
 *
 * Supabase's resetPasswordForEmail() sends a URL like:
 *   <origin>/login/reset-password#access_token=...&refresh_token=...&type=recovery
 *
 * The hash fragment isn't readable server-side, so this is a client
 * component that parses it, posts { access_token, password } to
 * /api/auth/reset-password, and redirects on success.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const tok = params.get("access_token");
    const err = params.get("error_description") || params.get("error");
    if (err) setError(decodeURIComponent(err));
    if (tok) setAccessToken(tok);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!accessToken) {
      setError("Reset link is missing or expired. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => router.push("/login"), 1500);
      } else {
        setError(data.error || "Something went wrong");
      }
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
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="text-muted mt-1">DIBS · Ever Ready First Aid</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 text-center">
            <p className="font-semibold">Password updated</p>
            <p className="text-sm text-muted mt-2">Redirecting to login…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 space-y-4"
          >
            {error && (
              <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">
                {error}
              </div>
            )}

            {!accessToken && !error && (
              <div className="rounded-lg bg-amber-50 text-amber-800 px-4 py-2 text-sm">
                Waiting for reset token… if this page is stuck, the link may be expired. <Link href="/login/forgot-password" className="underline font-medium">Request a new one</Link>.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm"
                placeholder="At least 8 characters"
                autoFocus
                required
                disabled={!accessToken}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-card-border px-3 py-2.5 text-sm"
                required
                disabled={!accessToken}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !accessToken}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update password"}
            </button>

            <Link
              href="/login"
              className="block text-center text-xs text-accent hover:text-accent-hover font-medium"
            >
              Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
