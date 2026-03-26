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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  if (accessToken && refreshToken) {
    try {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch {
      // Invalid session — will return null user
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
