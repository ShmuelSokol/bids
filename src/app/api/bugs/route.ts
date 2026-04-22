import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";

const OWNER = "ShmuelSokol";
const REPO = "bids";

/**
 * GET /api/bugs — list all open issues with full details (admin only)
 * POST /api/bugs — post a comment to an issue (admin only)
 */

async function checkAdmin(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user?.profile?.role || !hasAdminAccess(user.profile.role)) {
    return null;
  }
  return user;
}

function getGithubToken() {
  return process.env.GITHUB_TOKEN || null;
}

export async function GET(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const token = getGithubToken();
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/issues?state=all&per_page=20&sort=created&direction=desc`,
      { headers }
    );
    const issues = await res.json();

    // Fetch comments for each issue
    const enriched = await Promise.all(
      (Array.isArray(issues) ? issues : []).map(async (issue: any) => {
        let comments: any[] = [];
        try {
          const commentsRes = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issue.number}/comments?per_page=20`,
            { headers }
          );
          comments = await commentsRes.json();
        } catch {}

        const labels = (issue.labels || []).map((l: any) => l.name);

        return {
          number: issue.number,
          title: issue.title.replace(/^\[Bug\]\s*|\[Feature Request\]\s*/i, ""),
          body: issue.body || "",
          state: issue.state,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          url: issue.html_url,
          type: labels.includes("feature") ? "feature" : "bug",
          priority: labels.find((l: string) => l.startsWith("priority:"))?.replace("priority: ", "") || "medium",
          comments: (Array.isArray(comments) ? comments : []).map((c: any) => ({
            id: c.id,
            body: c.body,
            created_at: c.created_at,
            user: c.user?.login || "unknown",
            isScreenshot: c.body?.includes("<img ") && c.body?.startsWith("### Screenshot"),
          })),
        };
      })
    );

    return NextResponse.json({ issues: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const token = getGithubToken();
  if (!token) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  const { issueNumber, comment, action } = await req.json();

  if (!issueNumber) {
    return NextResponse.json({ error: "issueNumber required" }, { status: 400 });
  }

  // Post comment
  if (comment) {
    const name = user.profile?.full_name || user.user?.email || "Admin";
    const body = `**${name}:** ${comment}`;

    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }
    );
  }

  // Close/reopen issue
  if (action === "close" || action === "reopen") {
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: action === "close" ? "closed" : "open" }),
      }
    );
  }

  return NextResponse.json({ success: true });
}
