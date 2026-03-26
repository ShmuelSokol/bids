import { NextResponse } from "next/server";

// Legacy Prisma route — stub. Expansion data now comes from Supabase fsc_expansion table.
export async function GET() {
  return NextResponse.json({
    message: "Use /analytics page for expansion data (powered by Supabase)",
    expansion: [],
  });
}
