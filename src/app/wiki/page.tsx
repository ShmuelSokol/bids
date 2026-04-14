import Link from "next/link";
import { WikiLayout } from "./wiki-layout";
import { WIKI_PAGES } from "./pages";

export default function WikiIndex() {
  return (
    <WikiLayout pages={WIKI_PAGES}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DIBS Wiki</h1>
        <p className="text-muted text-lg">
          The story, decisions, and hard-won lessons behind this system.
        </p>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-8">
        <p className="text-sm leading-relaxed text-foreground">
          This isn&apos;t API documentation. The code already tells you <em>what</em> it does.
          This wiki is the <em>why</em>: the failed approaches, the empirical findings,
          the subtle bugs that took days to track down, and the mental model behind
          the choices we made. Read this when you want to understand how we got here —
          or before you change something and find out the hard way.
        </p>
      </div>

      <h2 className="text-xl font-semibold mb-4">Contents</h2>
      <div className="grid gap-3">
        {WIKI_PAGES.map((p, i) => (
          <Link
            key={p.slug}
            href={`/wiki/${p.slug}`}
            className="block rounded-lg border border-card-border bg-card-bg p-4 hover:border-accent transition-colors group"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                  {p.title}
                </h3>
                {p.subtitle && (
                  <p className="text-sm text-muted mt-0.5">{p.subtitle}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </WikiLayout>
  );
}
