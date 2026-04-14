"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function WikiRenderer({ content }: { content: string }) {
  return (
    <article className="prose prose-neutral max-w-none">
      <style>{`
        .prose h1 { font-size: 2rem; font-weight: 700; margin-top: 0; margin-bottom: 0.5rem; }
        .prose h2 { font-size: 1.35rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 0.75rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--card-border, #e5e7eb); }
        .prose h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.5rem; }
        .prose p { line-height: 1.75; margin: 0.9rem 0; color: #1a1a2e; font-size: 16px; }
        .prose ul, .prose ol { padding-left: 1.5rem; margin: 0.75rem 0; }
        .prose li { line-height: 1.7; margin: 0.25rem 0; }
        .prose code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: 'SF Mono', Consolas, monospace; color: #b91c1c; }
        .prose pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 10px; overflow-x: auto; margin: 1.25rem 0; font-size: 13px; line-height: 1.6; }
        .prose pre code { background: transparent; padding: 0; color: inherit; font-size: inherit; }
        .prose blockquote { border-left: 3px solid #3b82f6; background: #eff6ff; padding: 12px 16px; margin: 1.25rem 0; color: #1e3a8a; font-style: italic; border-radius: 0 6px 6px 0; }
        .prose table { border-collapse: collapse; margin: 1.25rem 0; font-size: 14px; display: block; overflow-x: auto; }
        .prose th { background: #f8fafc; padding: 8px 12px; text-align: left; font-weight: 600; border: 1px solid #e2e8f0; }
        .prose td { padding: 8px 12px; border: 1px solid #e2e8f0; }
        .prose tr:nth-child(even) td { background: #fafafa; }
        .prose a { color: #2563eb; text-decoration: underline; }
        .prose a:hover { color: #1e40af; }
        .prose hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
        .prose strong { color: #0f172a; font-weight: 600; }
        .prose .aside { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px 16px; margin: 1.25rem 0; border-radius: 0 6px 6px 0; font-size: 14px; }
      `}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
