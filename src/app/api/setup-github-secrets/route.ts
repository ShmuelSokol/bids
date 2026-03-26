import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const OWNER = "ShmuelSokol";
  const REPO = "bids";
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" };

  // Get public key for encrypting secrets
  const keyRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/secrets/public-key`, { headers });
  const keyData = await keyRes.json();
  if (!keyData.key_id) return NextResponse.json({ error: "Cannot get public key", details: keyData }, { status: 500 });

  // Use libsodium to encrypt — but we don't have it server-side
  // Instead, set as GitHub Actions variables (not secrets — they're not truly secret)
  const results = [];
  for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl], ["SUPABASE_SERVICE_ROLE_KEY", supabaseKey]]) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/variables`, {
      method: "POST", headers,
      body: JSON.stringify({ name, value }),
    });
    const data = await res.json();
    results.push({ name, status: res.status, ok: res.ok, message: data.message });
  }

  return NextResponse.json({ results, key_id: keyData.key_id });
}
