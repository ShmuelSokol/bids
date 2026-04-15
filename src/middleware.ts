import { NextRequest, NextResponse } from "next/server";

// Public paths skip the session-cookie redirect. Routes that cost money or
// mutate data MUST gate themselves internally (auth check OR shared secret),
// e.g. /api/whatsapp verifies X-Internal-Secret or a logged-in user.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/dibbs", "/api/track", "/api/bug-report", "/api/notifications", "/api/jobs", "/api/bugs/respond", "/api/awards", "/api/setup-github-secrets", "/api/whatsapp", "/api/webhooks"];

// Pass pathname to layout via header for must_reset_password check

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("sb-access-token")?.value;

  // If already logged in and hitting the login page (or
  // forgot-password), bounce to dashboard. Reset-password stays
  // accessible because the user lands there from an email link
  // and may have a stale session from a different account.
  if (
    token &&
    (pathname === "/login" || pathname === "/login/forgot-password")
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
