import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/awards/search
 *
 * Unified award search across multiple public data sources:
 * 1. USASpending.gov (free, no auth)
 * 2. SAM.gov Contract Awards API (free API key required)
 *
 * Use for: competitor research, pricing history, win/loss analysis
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cage = searchParams.get("cage");
  const keyword = searchParams.get("keyword");
  const startDate = searchParams.get("start") || "2024-01-01";
  const endDate = searchParams.get("end") || "2026-12-31";
  const source = searchParams.get("source") || "usaspending"; // usaspending or sam

  if (source === "sam") {
    return searchSamGov(cage, keyword, startDate, endDate, searchParams.get("apiKey"));
  }

  return searchUsaSpending(cage, keyword, startDate, endDate);
}

async function searchUsaSpending(
  cage: string | null,
  keyword: string | null,
  startDate: string,
  endDate: string
) {
  const filters: Record<string, unknown> = {
    time_period: [{ start_date: startDate, end_date: endDate }],
    award_type_codes: ["A", "B", "C", "D"],
    agencies: [
      {
        type: "awarding",
        tier: "toptier",
        name: "Department of Defense",
      },
    ],
  };

  if (cage) filters.recipient_search_text = [cage];
  if (keyword) filters.keywords = [keyword];

  try {
    const response = await fetch(
      "https://api.usaspending.gov/api/v2/search/spending_by_award/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          fields: [
            "Award ID",
            "Recipient Name",
            "Award Amount",
            "Total Outlays",
            "Description",
            "Start Date",
            "End Date",
            "Awarding Agency",
            "Awarding Sub Agency",
            "Award Type",
          ],
          page: 1,
          limit: 100,
          sort: "Start Date",
          order: "desc",
          subawards: false,
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `USASpending returned ${response.status}`, source: "usaspending" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ source: "usaspending", ...data });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach USASpending API", source: "usaspending" },
      { status: 502 }
    );
  }
}

async function searchSamGov(
  cage: string | null,
  keyword: string | null,
  startDate: string,
  endDate: string,
  apiKey: string | null
) {
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "SAM.gov requires an API key. Register free at sam.gov.",
        registrationUrl: "https://sam.gov/content/entity-registration",
        source: "sam",
      },
      { status: 401 }
    );
  }

  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  if (cage) params.set("awardeeCageCode", cage);
  if (keyword) params.set("keyword", keyword);
  params.set("dateSigned", `[${startDate},${endDate}]`);
  params.set("contractingDepartmentName", "DEFENSE LOGISTICS AGENCY");
  params.set("limit", "100");

  try {
    const response = await fetch(
      `https://api.sam.gov/contract-awards/v1/search?${params.toString()}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `SAM.gov returned ${response.status}`, source: "sam" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ source: "sam", ...data });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach SAM.gov API", source: "sam" },
      { status: 502 }
    );
  }
}
