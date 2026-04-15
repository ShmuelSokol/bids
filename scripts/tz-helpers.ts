/**
 * LamLinks SQL Server 2012's clock is America/New_York, but
 * msnodesqlv8 returns plain DATETIME values tagged with Z as if they
 * were UTC. `uptime_k34 = 3:27 PM ET` comes back as Date(15:27Z)
 * which formats to 11:27 AM ET — 4h behind (in DST).
 *
 * SQL Server 2012 pre-dates AT TIME ZONE (2016+), so we fix on the
 * JS side: pull the wall-clock numbers the driver returned, compute
 * the ET offset for that instant via Intl (DST-correct), rebuild
 * the true UTC.
 *
 * Use everywhere we import naive LamLinks datetimes into Supabase.
 */
export function etNaiveToUtcIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;

  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  const da = date.getUTCDate();
  const h = date.getUTCHours();
  const mi = date.getUTCMinutes();
  const s = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();

  const probe = new Date(Date.UTC(y, mo, da, h, mi, s, ms));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour12: false,
  }).formatToParts(probe);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-05:00";
  const m = tzPart.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = m?.[1] === "-" ? -1 : 1;
  const hrs = Number(m?.[2] || 0);
  const mins = Number(m?.[3] || 0);
  const offsetMs = sign * (hrs * 60 + mins) * 60 * 1000;

  return new Date(probe.getTime() - offsetMs).toISOString();
}
