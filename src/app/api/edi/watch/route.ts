import { NextRequest, NextResponse } from "next/server";
import { scanAndProcessEdiFiles, getWatcherStatus } from "@/lib/edi-watcher";

/**
 * GET /api/edi/watch — Get watcher status (pending/processed/error file counts)
 * POST /api/edi/watch — Trigger a manual scan of the incoming EDI folder
 */
export async function GET() {
  const status = await getWatcherStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const config = body.config
    ? {
        incomingDir: body.config.incomingDir || "C:\\LamlinksEDI\\incoming",
        processedDir: body.config.processedDir || "C:\\LamlinksEDI\\processed",
        errorDir: body.config.errorDir || "C:\\LamlinksEDI\\errors",
        filePattern: body.config.filePattern || ".edi",
        pollIntervalMs: body.config.pollIntervalMs || 30000,
      }
    : undefined;

  const result = await scanAndProcessEdiFiles(config);
  return NextResponse.json(result);
}
