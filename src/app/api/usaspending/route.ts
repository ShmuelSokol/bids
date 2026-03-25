import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/usaspending?cage=0AG09&nsn=6515-01-234-5678
 *
 * Proxy for USASpending.gov API — public contract award data.
 * USASpending has a free REST API with no authentication required.
 * Docs: https://api.usaspending.gov/
 *
 * Useful endpoints:
 * - /api/v2/search/spending_by_award/ — search awards
 * - /api/v2/awards/ — award details
 * - /api/v2/recipient/ — recipient (contractor) details by DUNS/cage
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cage = searchParams.get("cage");
  const keyword = searchParams.get("keyword");
  const naics = searchParams.get("naics");
  const psc = searchParams.get("psc"); // Product Service Code (similar to FSC)

  // Build USASpending API request
  const filters: Record<string, unknown> = {
    time_period: [
      {
        start_date: "2024-01-01",
        end_date: "2026-12-31",
      },
    ],
    award_type_codes: ["A", "B", "C", "D"], // Contracts
  };

  if (cage) {
    filters.recipient_search_text = [cage];
  }
  if (keyword) {
    filters.keywords = [keyword];
  }
  if (psc) {
    filters.psc_codes = { require: [[psc]] };
  }
  if (naics) {
    filters.naics_codes = { require: [[naics]] };
  }

  try {
    const response = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
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
          "recipient_id",
          "internal_id",
        ],
        page: 1,
        limit: 50,
        sort: "Award Amount",
        order: "desc",
        subawards: false,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `USASpending API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch from USASpending API" },
      { status: 500 }
    );
  }
}
