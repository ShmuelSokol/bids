import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function createServerClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return createClient("https://placeholder.supabase.co", "placeholder");
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;

  // Don't pin Authorization header up front. Access tokens expire
  // after 1h by default and any previous session would block
  // setSession's refresh. Let setSession drive the auth state.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (accessToken && refreshToken) {
    try {
      // setSession will call the refresh_token endpoint if the
      // access_token is expired, then install the fresh access_token
      // on the client's Authorization header for subsequent queries.
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // If refresh happened, persist the new tokens in the cookie so
      // we don't re-refresh on every route call.
      if (!error && data.session && data.session.access_token !== accessToken) {
        try {
          cookieStore.set("sb-access-token", data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
          });
          if (data.session.refresh_token) {
            cookieStore.set("sb-refresh-token", data.session.refresh_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 30,
              path: "/",
            });
          }
        } catch {
          // cookies().set() throws in page/render contexts — harmless;
          // the in-memory session is already correct for this request.
        }
      }
    } catch {
      // Invalid tokens — caller will see null user, route returns 401.
    }
  }

  return supabase;
}

export function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return createClient("https://placeholder.supabase.co", "placeholder");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export async function getCurrentUser() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return { user, profile };
  } catch {
    return null;
  }
}
