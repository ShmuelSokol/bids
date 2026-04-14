"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";

export interface WikiPage {
  slug: string;
  title: string;
  subtitle?: string;
}

export function WikiLayout({
  pages,
  children,
}: {
  pages: WikiPage[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentSlug = pathname.split("/").pop();

  return (
    <div className="flex min-h-screen">
      {/* TOC sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-card-border bg-card-bg p-6 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-accent" />
          <span>DIBS Wiki</span>
        </div>
        <p className="text-xs text-muted mb-6">
          The story, decisions, and empirical learnings behind this system.
        </p>
        <nav className="space-y-1">
          <Link
            href="/wiki"
            className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
              pathname === "/wiki"
                ? "bg-accent/10 text-accent font-medium"
                : "text-muted hover:bg-accent/5 hover:text-foreground"
            }`}
          >
            Contents
          </Link>
          {pages.map((p) => (
            <Link
              key={p.slug}
              href={`/wiki/${p.slug}`}
              className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                currentSlug === p.slug
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:bg-accent/5 hover:text-foreground"
              }`}
            >
              {p.title}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 px-4 py-8 md:px-12 md:py-12 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  );
}
