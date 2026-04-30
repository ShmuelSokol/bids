/**
 * Email-discovery utilities for the supplier auto-onboarding flow.
 * Fetches a supplier's contact pages, extracts email addresses, and
 * scores them for RFQ usability.
 *
 * No Playwright — plain fetch + regex. Many supplier sites are static
 * enough; the ones that aren't (Grainger, Mouser etc) don't really
 * accept RFQs by email anyway.
 */

const COMMON_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/contactus",
  "/about",
  "/about-us",
  "/sales",
  "/quote",
  "/quote-request",
  "/get-quote",
];

// Filter out role-aliases that are useless for RFQs
const NOISE_LOCAL_PARTS = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "abuse", "postmaster", "webmaster", "hostmaster",
  "privacy", "legal", "compliance", "spam",
  "newsletter", "updates", "noticias",
  "test", "example", "user", "admin",
]);

// Local parts that are ideal RFQ targets
const PREFERRED_LOCAL_PARTS = new Set([
  "sales", "quotes", "quote", "rfq", "rfqs", "info", "contact",
  "orders", "purchasing", "bd", "biz", "business",
  "customerservice", "customer-service", "csr",
]);

export type DiscoveredEmail = {
  email: string;
  source_url: string;
  same_domain: boolean;
  preferred: boolean;
  score: number;     // 0..1
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/**
 * Extract candidate emails from HTML. Strips <script>/<style>, then
 * regex over visible text + href="mailto:" attrs.
 */
export function extractEmails(html: string, sourceUrl: string, baseDomain: string): DiscoveredEmail[] {
  // Strip tags but preserve mailto: hrefs
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const found = new Set<string>();
  // Capture mailto: explicitly (often only place email lives w/o obfuscation)
  const mailtoRe = /mailto:([^"'?\s>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(stripped))) found.add(m[1].toLowerCase());

  // Then regex on visible text
  const txt = stripped.replace(/<[^>]+>/g, " ");
  const matches = txt.match(EMAIL_RE) || [];
  for (const e of matches) found.add(e.toLowerCase());

  const baseDomainLower = baseDomain.toLowerCase();
  const out: DiscoveredEmail[] = [];
  for (const email of Array.from(found)) {
    const [local, domain] = email.split("@");
    if (!domain || !local) continue;
    if (NOISE_LOCAL_PARTS.has(local)) continue;
    // Strip extension contains junk like "you" / "name" / "your-email"
    if (/^(you|name|your[-_]?email|email|user|first\.last)$/.test(local)) continue;
    // Domain blacklist (CDNs, image hosts, common false positives)
    if (/^(cdn|images?|static|cloudflare|googleapis|gstatic)\./i.test(domain)) continue;
    if (/\.(png|jpg|jpeg|gif|svg|css|js)$/i.test(domain)) continue;

    const sameDomain = domain === baseDomainLower || domain.endsWith("." + baseDomainLower);
    const preferred = PREFERRED_LOCAL_PARTS.has(local);
    let score = 0.3;
    if (sameDomain) score += 0.4;
    if (preferred) score += 0.2;
    if (sameDomain && preferred) score = 0.95;
    out.push({ email, source_url: sourceUrl, same_domain: sameDomain, preferred, score });
  }
  return out;
}

/**
 * Try multiple common URL paths under a base domain, return first that
 * yields any candidate emails. Stops on first success to be polite.
 */
export async function discoverEmailsForUrl(
  baseUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<{ emails: DiscoveredEmail[]; tried: string[]; lastError?: string }> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const tried: string[] = [];
  let lastError: string | undefined;

  // Normalize base URL
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return { emails: [], tried: [], lastError: "invalid base URL" };
  }
  const baseDomain = base.hostname.replace(/^www\./, "");

  for (const path of COMMON_PATHS) {
    const url = new URL(path, `${base.protocol}//${base.host}`).toString();
    tried.push(url);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DIBS-RFQ-Bot; +https://dibs-gov-production.up.railway.app)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(t);
      if (!r.ok) {
        lastError = `${url}: HTTP ${r.status}`;
        continue;
      }
      const html = await r.text();
      const emails = extractEmails(html, url, baseDomain);
      if (emails.length > 0) {
        return { emails: dedup(emails), tried };
      }
    } catch (e: any) {
      lastError = `${url}: ${e?.message || String(e)}`;
    }
  }
  return { emails: [], tried, lastError };
}

function dedup(arr: DiscoveredEmail[]): DiscoveredEmail[] {
  const m = new Map<string, DiscoveredEmail>();
  for (const e of arr) {
    const ex = m.get(e.email);
    if (!ex || e.score > ex.score) m.set(e.email, e);
  }
  return Array.from(m.values()).sort((a, b) => b.score - a.score);
}
