/**
 * Safe AX OData fetchers for API routes. Mirrors scripts/ax-fetch.ts.
 *
 * See docs/gotchas.md → "AX OData silent 1000-row cap" for context.
 */

const HIDDEN_CAP = 1000;

export type AxFetchResult<T = any> = {
  rows: T[];
  truncated: boolean;
  pageCount: number;
};

export async function fetchAxPaginated(
  token: string,
  url: string,
  opts: { maxRows?: number; label?: string } = {}
): Promise<AxFetchResult> {
  const { maxRows = 100000, label } = opts;
  const rows: any[] = [];
  let next: string | null = url;
  let pageCount = 0;
  let truncated = false;
  while (next && rows.length < maxRows) {
    const r = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`AX fetch ${r.status} on ${next.slice(0, 120)}: ${body.slice(0, 200)}`);
    }
    const data: any = await r.json();
    const page = data.value || [];
    rows.push(...page);
    pageCount++;
    next = data["@odata.nextLink"] || null;
    if (!next && page.length === HIDDEN_CAP && url.includes("$filter")) {
      truncated = true;
      console.warn(`[AX cap] ${label || "query"} returned exactly ${HIDDEN_CAP} rows with no nextLink — likely truncated.`);
    }
  }
  return { rows, truncated, pageCount };
}

export async function fetchAxByMonth(
  token: string,
  opts: {
    D365_URL: string;
    entity: string;
    dateField: string;
    monthsBack: number;
    baseFilter?: string;
    select?: string[];
    orderBy?: string;
  }
): Promise<AxFetchResult> {
  const { D365_URL, entity, dateField, monthsBack, baseFilter, select, orderBy } = opts;
  const rows: any[] = [];
  let truncated = false;
  let pageCount = 0;
  for (let m = 0; m < monthsBack; m++) {
    const end = new Date();
    end.setUTCDate(1); end.setUTCHours(0, 0, 0, 0);
    end.setUTCMonth(end.getUTCMonth() - m);
    const start = new Date(end);
    start.setUTCMonth(end.getUTCMonth() - 1);
    const dateClause = `${dateField} ge ${start.toISOString()} and ${dateField} lt ${end.toISOString()}`;
    const filter = baseFilter ? `(${baseFilter}) and ${dateClause}` : dateClause;
    const selectPart = select ? `&$select=${select.join(",")}` : "";
    const orderPart = orderBy ? `&$orderby=${encodeURIComponent(orderBy)}` : "";
    const url = `${D365_URL}/data/${entity}?cross-company=true&$top=1000&$filter=${encodeURIComponent(filter)}${selectPart}${orderPart}`;
    const result = await fetchAxPaginated(token, url, { label: `${entity} [${start.toISOString().slice(0, 7)}]` });
    rows.push(...result.rows);
    if (result.truncated) truncated = true;
    pageCount += result.pageCount;
  }
  return { rows, truncated, pageCount };
}
