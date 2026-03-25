import { NextRequest, NextResponse } from "next/server";
import {
  scrapeSolicitations,
  scrapeAwards,
  downloadBatchFile,
  type DibbsCredentials,
} from "@/lib/dibbs-scraper";

/**
 * POST /api/dibbs/scrape
 *
 * Trigger DIBBS scraping. Actions:
 * - action: "solicitations" — scrape open solicitations by FSC codes
 * - action: "awards" — scrape awards by cage code
 * - action: "batch" — download the batch quote CSV file
 *
 * Body: { action, credentials: { username, password }, fscCodes?, cageCode?, days? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, credentials } = body;

  if (!credentials?.username || !credentials?.password) {
    return NextResponse.json(
      { error: "DIBBS credentials required (username + password)" },
      { status: 400 }
    );
  }

  const creds: DibbsCredentials = {
    username: credentials.username,
    password: credentials.password,
  };

  switch (action) {
    case "solicitations": {
      const fscCodes: string[] = body.fscCodes || ["6515", "6510", "6545"];
      const result = await scrapeSolicitations(creds, fscCodes);
      return NextResponse.json(result);
    }

    case "awards": {
      const cageCode: string = body.cageCode || "0AG09";
      const days: number = body.days || 15;
      const result = await scrapeAwards(creds, cageCode, days);
      return NextResponse.json(result);
    }

    case "batch": {
      const result = await downloadBatchFile(creds);
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Use: solicitations, awards, or batch` },
        { status: 400 }
      );
  }
}
