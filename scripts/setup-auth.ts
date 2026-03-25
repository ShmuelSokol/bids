/**
 * Set up Supabase Auth: profiles table, roles, RLS, admin user.
 * Uses supabase-js admin client + direct SQL via pg connection string.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jzgvdfzboknpcrhymjob.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Use the SQL editor REST endpoint (requires service_role key)
async function runSQL(sql: string) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({}),
  });
  // This won't work for DDL — use the pg_net extension or management API
  // Instead, let's use a different approach: create a function that runs SQL
}

async function main() {
  // Step 1: Create admin user via Supabase Auth
  console.log("Creating admin user...");
  const { data: userData, error: userErr } =
    await supabase.auth.admin.createUser({
      email: "ssokol@everreadygroup.com",
      password: "D1bs-Admin-2026!",
      email_confirm: true,
      user_metadata: { full_name: "Shmuel Sokol" },
    });

  let userId: string;
  if (userErr) {
    if (userErr.message.includes("already been registered")) {
      console.log("  User already exists, finding ID...");
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find(
        (u) => u.email === "ssokol@everreadygroup.com"
      );
      if (!existing) throw new Error("Can't find existing user");
      userId = existing.id;
    } else {
      throw userErr;
    }
  } else {
    userId = userData.user.id;
    console.log("  Created user:", userId);
  }

  // Step 2: Create Abe's account
  console.log("Creating Abe's account...");
  const { data: abeData, error: abeErr } =
    await supabase.auth.admin.createUser({
      email: "abe@everreadygroup.com",
      password: "D1bs-Abe-2026!",
      email_confirm: true,
      user_metadata: { full_name: "Abe" },
    });
  if (abeErr && !abeErr.message.includes("already been registered")) {
    console.log("  Abe error:", abeErr.message);
  } else {
    console.log("  Abe created");
  }

  // Step 3: Create profiles table (using the management API via supabase CLI workaround)
  // Since the management API token expired, we'll create the table structure
  // via a Supabase SQL function that the service_role can call.
  // Actually — let's just check if profiles table exists and insert directly.

  console.log("Checking profiles table...");
  const { error: checkErr } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);

  if (checkErr && checkErr.message.includes("does not exist")) {
    console.log("  Profiles table doesn't exist yet.");
    console.log("  Please create it via the Supabase Dashboard SQL editor:");
    console.log(`
    Go to: https://supabase.com/dashboard/project/jzgvdfzboknpcrhymjob/sql/new

    Paste and run this SQL:

    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('admin', 'manager', 'viewer')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY profiles_select_admin ON profiles FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
    CREATE POLICY profiles_update_admin ON profiles FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

    CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO profiles (id, email, full_name, role)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'viewer');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
    `);
  } else {
    console.log("  Profiles table exists!");
    // Upsert admin profile
    const { error: upsertErr } = await supabase.from("profiles").upsert({
      id: userId,
      email: "ssokol@everreadygroup.com",
      full_name: "Shmuel Sokol",
      role: "admin",
    });
    if (upsertErr) console.log("  Profile upsert error:", upsertErr.message);
    else console.log("  Admin profile set");
  }

  console.log("\nAuth users created:");
  console.log("  Admin: ssokol@everreadygroup.com / D1bs-Admin-2026!");
  console.log("  User:  abe@everreadygroup.com / D1bs-Abe-2026!");
}

main().catch(console.error);
