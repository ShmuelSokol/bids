import { NextResponse } from "next/server";
import { setSystemSetting } from "@/lib/system-settings";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "expected { enabled: boolean }" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: session } = await supabase.auth.getUser();
    const updatedBy = session?.user?.email || "unknown";

    await setSystemSetting("lamlinks_invoice_writeback_enabled", body.enabled ? "true" : "false", updatedBy);

    return NextResponse.json({ ok: true, enabled: body.enabled });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
