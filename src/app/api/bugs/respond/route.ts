import { NextRequest, NextResponse } from "next/server";

const OWNER = "ShmuelSokol";
const REPO = "bids";

/**
 * POST /api/bugs/respond — post a comment + optionally close an issue
 * Uses internal secret for automation (Claude session calling Railway)
 */
export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return NextResponse.json({ error: "No GitHub token" }, { status: 500 });

  const { issueNumber, comment, close } = await req.json();
  if (!issueNumber || !comment) {
    return NextResponse.json({ error: "issueNumber and comment required" }, { status: 400 });
  }

  // Post comment
  const commentRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: comment }),
    }
  );

  if (!commentRes.ok) {
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }

  // Close if requested
  if (close) {
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: "closed" }),
      }
    );
  }

  return NextResponse.json({ success: true, closed: !!close });
}
