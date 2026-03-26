import { NextResponse } from "next/server";

const OWNER = "ShmuelSokol";
const REPO = "bids";

/**
 * GET /api/notifications — fetch open GitHub issues (bug reports) for the notification bar.
 * Public repo, no auth needed for reading.
 */
export async function GET() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/issues?state=all&per_page=20&sort=created&direction=desc`,
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        cache: "no-store", // always fresh — bug submissions need instant visibility
      }
    );

    if (!res.ok) {
      return NextResponse.json({ issues: [], error: "GitHub API error" });
    }

    const issues = await res.json();

    // Get comments for each issue to check if we've responded
    const enriched = await Promise.all(
      issues.map(async (issue: any) => {
        let hasResponse = false;
        let responsePreview = "";

        if (issue.comments > 0) {
          try {
            const commentsRes = await fetch(
              `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issue.number}/comments?per_page=5`,
              {
                headers: { Accept: "application/vnd.github.v3+json" },
                cache: "no-store",
              }
            );
            if (commentsRes.ok) {
              const comments = await commentsRes.json();
              // Check for non-screenshot comments (screenshots are just <img> tags)
              const textComments = comments.filter(
                (c: any) => c.body && !c.body.startsWith("### Screenshot")
              );
              if (textComments.length > 0) {
                hasResponse = true;
                responsePreview = textComments[textComments.length - 1].body.slice(0, 200);
              }
            }
          } catch {}
        }

        // Parse priority and type from labels
        const labels = (issue.labels || []).map((l: any) => l.name);
        const priority = labels.find((l: string) => l.startsWith("priority:"))?.replace("priority: ", "") || "medium";
        const type = labels.includes("feature") ? "feature" : "bug";

        // Extract page and reporter from body
        const pageMatch = issue.body?.match(/\*\*Page:\*\*\s*(https?:\/\/\S+)/);
        const page = pageMatch ? new URL(pageMatch[1]).pathname : null;
        const reporterMatch = issue.body?.match(/\*\*Reporter:\*\*\s*(.+)/);
        const reporter = reporterMatch?.[1]?.trim() || "Anonymous";

        return {
          number: issue.number,
          title: issue.title.replace(/^\[Bug\]\s*|\[Feature Request\]\s*/i, ""),
          type,
          priority,
          state: issue.state,
          created_at: issue.created_at,
          page,
          reporter,
          hasResponse,
          responsePreview,
          url: issue.html_url,
          hasScreenshot: issue.comments > 0 && !hasResponse,
        };
      })
    );

    return NextResponse.json({ issues: enriched });
  } catch {
    return NextResponse.json({ issues: [], error: "Failed to fetch" });
  }
}
