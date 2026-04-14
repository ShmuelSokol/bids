import { notFound } from "next/navigation";
import { readFileSync, existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WikiLayout } from "../wiki-layout";
import { WikiRenderer } from "../wiki-renderer";
import { WIKI_PAGES } from "../pages";

export const dynamic = "force-static";

export function generateStaticParams() {
  return WIKI_PAGES.map((p) => ({ slug: p.slug }));
}

export default async function WikiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const idx = WIKI_PAGES.findIndex((p) => p.slug === slug);
  if (idx === -1) notFound();

  const page = WIKI_PAGES[idx];
  const prev = idx > 0 ? WIKI_PAGES[idx - 1] : null;
  const next = idx < WIKI_PAGES.length - 1 ? WIKI_PAGES[idx + 1] : null;

  const filePath = path.join(process.cwd(), "docs", `${slug}.md`);
  if (!existsSync(filePath)) {
    return (
      <WikiLayout pages={WIKI_PAGES}>
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="text-muted mt-4">Content coming soon.</p>
      </WikiLayout>
    );
  }

  const content = readFileSync(filePath, "utf8");

  return (
    <WikiLayout pages={WIKI_PAGES}>
      <div className="mb-8">
        <Link href="/wiki" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent mb-4">
          <ChevronLeft className="h-4 w-4" /> All pages
        </Link>
      </div>

      <WikiRenderer content={content} />

      {/* Prev/Next navigation */}
      <div className="mt-16 pt-6 border-t border-card-border grid grid-cols-2 gap-4">
        {prev ? (
          <Link
            href={`/wiki/${prev.slug}`}
            className="flex items-center gap-3 rounded-lg border border-card-border p-4 hover:border-accent transition-colors group"
          >
            <ChevronLeft className="h-5 w-5 text-muted group-hover:text-accent" />
            <div>
              <div className="text-xs text-muted">Previous</div>
              <div className="font-medium">{prev.title}</div>
            </div>
          </Link>
        ) : <div />}
        {next ? (
          <Link
            href={`/wiki/${next.slug}`}
            className="flex items-center justify-end gap-3 rounded-lg border border-card-border p-4 hover:border-accent transition-colors group text-right"
          >
            <div>
              <div className="text-xs text-muted">Next</div>
              <div className="font-medium">{next.title}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted group-hover:text-accent" />
          </Link>
        ) : <div />}
      </div>
    </WikiLayout>
  );
}
