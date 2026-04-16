/**
 * Safe AX OData fetchers that detect the silent 1000-row cap.
 *
 * Discovered 2026-04-16: AX OData endpoints enforce a hidden 1000-row
 * ceiling per filtered query and do NOT emit @odata.nextLink beyond
 * that. A result set of exactly 1000 rows with no nextLink is almost
 * certainly truncated. We had been silently losing 88% of data on
 * DD219 PO line queries (1000 returned of 8533 actual).
 *
 * These helpers:
 *   - Follow @odata.nextLink when emitted (normal pagination)
 *   - WARN when a page hits 1000 rows without a nextLink
 *   - Return a `truncated` flag so callers can decide to retry with
 *     narrower filters
 *   - fetchAxByMonth() auto-chunks a query by a date field so each
 *     chunk stays under the cap
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
    // Silent-cap heuristic: exactly HIDDEN_CAP rows AND no nextLink on a
    // FILTERED query almost always means truncation.
    if (!next && page.length === HIDDEN_CAP && url.includes("$filter")) {
      truncated = true;
      if (label) {
        console.warn(`  ⚠ AX silent cap hit on "${label}" — got exactly ${HIDDEN_CAP} rows with no nextLink. Actual count likely higher.`);
      } else {
        console.warn(`  ⚠ AX silent cap hit — got exactly ${HIDDEN_CAP} rows with no nextLink. Truncation likely.`);
      }
    }
  }
  return { rows, truncated, pageCount };
}

/**
 * Walk a filtered query backwards in monthly chunks. Use when you
 * expect the result set to exceed the cap (e.g. full history of
 * DD219 PO lines).
 *
 *   const { rows } = await fetchAxByMonth(token, {
 *     D365_URL: process.env.AX_D365_URL!,
 *     entity: "PurchaseOrderHeadersV2",
 *     dateField: "AccountingDate",
 *     baseFilter: "OrderVendorAccountNumber eq 'ABC'",  // optional
 *     monthsBack: 24,
 *     select: ["PurchaseOrderNumber", "AccountingDate"],
 *   });
 *
 * Returns the union of all rows, with truncated=true if any single
 * month hit the cap (which means a month had >1000 rows).
 */
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
