# Auto-Fix Context

This file is read by Claude Code when an automated error-fix session
is triggered by a production error. It supplements CLAUDE.md with
operational context that normally lives in the developer's local memory.

## Critical Data Rules

### Supabase
- Default row limit is 1,000. Any query without .range() pagination caps silently.
- Exact-1000 counts = almost always a silent cap, not a real count.
- .limit(5000) does NOT work — still caps at 1000.
- Must paginate with .range(page*1000, (page+1)*1000-1) in a loop.

### AX OData (D365)
- Filtered queries ($filter) silently cap at 1,000 rows with NO @odata.nextLink.
- Unfiltered bulk pulls paginate fine via nextLink.
- ALL filtered AX callers MUST use: scripts/ax-fetch.ts or src/lib/ax-fetch.ts
- fetchAxByMonth auto-narrows to weekly if a month exceeds 1000.
- DD219 = CustomerRequisitionNumber on PO lines (Abe's manual tag for government orders).
- Case variants exist — use toupper() or OR filter.

## Key Tables and Expected Sizes
- awards: ~150K (44K ours + 106K competitor)
- nsn_costs: ~24K
- nsn_vendor_prices: ~30K
- nsn_matches: ~7.5K
- nsn_catalog: ~24K
- dibbs_solicitations: ~22K
- abe_bids_live: ~3.5K (30-day window)
- abe_bids: ~10K (historical, may be capped)
- po_award_links: ~950
- invoice_state_events: ~1.4K
- client_errors: growing (error capture table)

## Common Error Patterns
- "Not authenticated" / 401 → token expired, check supabase-server.ts setSession flow
- Empty data on a page → likely Supabase 1000-row cap, check pagination
- Missing competitor awards in history → check if NsnHistoryDetail is used (not old inline tables)
- AX data looks low → check for silent 1000-row cap, use fetchAxByMonth
- Build fails on Railway → check for native deps (mssql, playwright, dotenv) in package.json

## What NOT to Do
- NEVER add msnodesqlv8, mssql, playwright, or dotenv to package.json
- NEVER use unstable_cache
- NEVER use git push --force
- NEVER auto-send POs to suppliers without Abe's approval
- NEVER write raw fetch() against AX with $filter — use the shared helpers
