/**
 * Date/time formatting helpers.
 *
 * Why this exists: `toLocaleString()` / `toLocaleTimeString()` without an
 * explicit locale AND timezone produces different output on the Railway
 * server (UTC) vs the client (America/New_York). When a server-rendered
 * component includes such output, React hydration sees a mismatch and
 * throws warning #418 (Text content did not match).
 *
 * Always format through these helpers so the server and the client agree
 * on what the string looks like.
 */

const TZ = "America/New_York";
const LOCALE = "en-US";

/** "Mar 27, 2026" — stable server ↔ client */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "3/27/2026" — short numeric date, stable */
export function formatDateShort(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(LOCALE, { timeZone: TZ });
}

/** "8:36 AM" — stable time */
export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3/27/2026, 8:36 AM" — date + time */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(LOCALE, {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
