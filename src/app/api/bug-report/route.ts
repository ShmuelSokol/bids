import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";

const OWNER = "ShmuelSokol";
const REPO = "bids";

export async function POST(req: NextRequest) {
  // Don't require auth for bug reports — should always work
  const user = await getCurrentUser().catch(() => null);

  const payload = await req.json();
  const { type, priority, description, expected, url, screenshot, screen_size } =
    payload;

  if (!description) {
    return NextResponse.json(
      { error: "Description required" },
      { status: 400 }
    );
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return NextResponse.json(
      { error: "GitHub not configured" },
      { status: 500 }
    );
  }

  const titlePrefix = type === "feature" ? "Feature Request" : "Bug";
  const title = `[${titlePrefix}] ${description.slice(0, 80)}`;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  let body = `## ${titlePrefix} Report\n\n`;
  body += `**Reporter:** ${user?.profile?.full_name || user?.user?.email || "Anonymous"}\n`;
  body += `**Priority:** ${priority || "medium"}\n`;
  body += `**Page:** ${url || "unknown"}\n`;
  body += `**Date:** ${now}\n\n`;
  body += `### Description\n${description}\n`;
  if (expected) body += `\n### Expected Behavior\n${expected}\n`;
  body += `\n### Environment\n- **Screen Size:** ${screen_size || "unknown"}\n`;

  const labels = [type || "bug"];
  if (priority && ["high", "medium", "low"].includes(priority)) {
    labels.push(`priority: ${priority}`);
  }

  try {
    const issueResp = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body, labels }),
      }
    );

    if (!issueResp.ok) {
      const text = await issueResp.text();
      console.error("GitHub issue creation failed:", text);
      return NextResponse.json(
        { error: "GitHub API error" },
        { status: 500 }
      );
    }

    const issue = await issueResp.json();

    // Upload screenshot as comment (async, don't block response)
    if (screenshot && screenshot.startsWith("data:image")) {
      fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issue.number}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: `### Screenshot\n\n<img src="${screenshot}" alt="Bug screenshot" />`,
          }),
        }
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      issue_number: issue.number,
      issue_url: issue.html_url,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
