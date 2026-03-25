import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const user = authenticateUser(username, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // In production: use proper session management (NextAuth, JWT, etc.)
  // For now, return user info — client stores in state
  return NextResponse.json({ user });
}
