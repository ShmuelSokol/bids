# Flow: Auth

Login, password reset, cookie-based session, middleware gating.

## Entry points

| Path | Purpose |
|------|---------|
| `/login` | Password login |
| `/login/forgot-password` | Email reset link |
| `/login/reset-password` | Handle magic-link reset |
| `/login/set-password` | Forced first-time password set (when `profile.must_reset_password=true`) |
| `POST /api/auth/login` | Session creation |
| `POST /api/auth/logout` | Clear session |
| `POST /api/auth/forgot-password` | Send reset email |
| `POST /api/auth/reset-password` | Complete reset |
| `POST /api/auth/set-password` | First-time set |

## Pipeline

```
[User navigates to any /path]
       │
       ▼
[src/middleware.ts]
  - If path is in PUBLIC_PATHS → allow
  - Else if no sb-access-token cookie → redirect /login
  - Else allow + set x-pathname header for layout
       │
       ▼
[src/app/layout.tsx]
  - getCurrentUser() from Supabase
  - If profile.must_reset_password && path !== /login/set-password → redirect
  - Else render sidebar + children
```

## Middleware (src/middleware.ts)

- Public paths (no auth): `/login`, `/api/auth`, `/api/dibbs`, `/api/track`, `/api/bug-report`, `/api/notifications`, `/api/jobs`, `/api/bugs/respond`, `/api/awards`, `/api/setup-github-secrets`, `/api/whatsapp`
- Static assets (`/_next`, `/favicon`, `.*`) — allowed.
- Everything else requires `sb-access-token` cookie → redirect to `/login` if missing.
- Sets `x-pathname` header so layout can detect `must_reset_password` redirect target.

## Role gating

- Roles stored on `profiles.role` (Supabase table).
- Checked explicitly only in a few places:
  - Bug reporting admin features (`/settings/bugs`)
  - Some settings actions
- **No role check on main features** (Dashboard, Solicitations, Orders, Analytics, Invoicing, Shipping). Any authenticated user has full access.

## Supabase tables

| Table | R/W | Columns |
|-------|-----|---------|
| `auth.users` (Supabase-managed) | R | id, email |
| `profiles` | R on every request, W on password set | `id`, `full_name`, `must_reset_password`, `role` |
| `user_activity` | W by `trackEvent()` | `user_id`, `event_type`, `event_action`, `details`, `ip_address`, `user_agent`, `created_at` |

## Business invariants

1. **Cookie names**:
   - `sb-access-token` (7-day maxAge)
   - `sb-refresh-token` (30-day maxAge)
2. **Logout clears both cookies.**
3. **Password minimum: 8 chars.** Enforced server-side in `/api/auth/reset-password:14` and `/api/auth/set-password:7`.
4. **`must_reset_password=true`** forces a redirect to `/login/set-password` before any other page loads. Cleared server-side in `/api/auth/set-password:47-50`.
5. **Forgot-password returns success unconditionally** — no email enumeration.
6. **Login uses anon key**; server routes use service role.

## Known gaps / TODOs

- **No RLS (Row-Level Security)** on any Supabase table. All API routes use service role and trust the auth cookie blindly.
- **No session idle timeout** — 7-day cookie lives full 7 days regardless of activity.
- **No CSRF protection** — password reset relies on Supabase magic-link security.
- **No rate limiting** on login / forgot-password.
- **No 2FA** (no Supabase MFA configured).
- **`must_reset_password`** is only checked in the layout; a direct API call could bypass it.
- **`bid_decisions` has no RLS** — authenticated user A can overwrite authenticated user B's decisions.
- **Auth cookies don't have `Secure` / `SameSite` flags set explicitly** (relies on Railway defaults).

## Referenced files

- `src/middleware.ts` — public path gate (3-38)
- `src/app/layout.tsx` — must_reset_password redirect (49-57)
- `src/lib/supabase-server.ts` — `getCurrentUser` (53-57), cookie read (14)
- `src/app/api/auth/login/route.ts` — login (20), cookie set (49, 56)
- `src/app/api/auth/logout/route.ts` — logout (19-20)
- `src/app/api/auth/forgot-password/route.ts` — reset email (17-24)
- `src/app/api/auth/reset-password/route.ts` — reset complete (27)
- `src/app/api/auth/set-password/route.ts` — first-time set (35, 47-50)
- `src/lib/auth.ts` — hardcoded role map (admin/viewer)
- `src/lib/track.ts` — activity logging (33-42)
