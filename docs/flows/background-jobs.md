# Flow: Background Jobs

Cron-driven worker that processes long-running tasks (supplier discovery, award lookups, NSN metadata crawls) from a Supabase-backed queue.

## Entry points

| Source | Trigger |
|--------|---------|
| `POST /api/jobs/process` | GitHub Actions cron every 10 min |
| `POST /api/jobs/process` | Manual curl |
| `POST /api/jobs/enqueue` | (if present) enqueue new jobs |

GitHub Actions workflow: `.github/workflows/job-processor.yml`. Hardcoded Railway URL.

## Job types

| Type | Purpose | External system | Notes |
|------|---------|-----------------|-------|
| `supplier_discovery` | Find wholesale suppliers for unsourced NSNs | DuckDuckGo scraping | Dedupe by domain. Currently broken — DDG blocks Railway IPs. |
| `nsn_crawl` | Pull NSN metadata from nsnlookup.com | nsnlookup.com | Gets item name, CAGE, description. |
| `award_lookup` | Get company name for a CAGE | cage.report | Saves to `cage_directory`. 203 stuck pending as of last check. |
| `usaspending_awards` | Pull DLA contracts for FSC + date range | USASpending API v2 | Paginated up to 10 pages. Upsert by contract_number. |

## Pipeline

```
[GitHub Actions cron — every 10 min]
       │
       ▼
POST /api/jobs/process
       │
       ▼
[Fair rotation through job_types array]
[Pull up to BATCH_SIZE (5) jobs per invocation]
[Per-type limit: up to 2 jobs of each type]
       │
       ▼
[For each job:]
  - Set status = "processing", started_at = now()
  - Switch on job_type:
    → supplier_discovery → DuckDuckGo search → dedupe → upsert to discovered_suppliers
    → nsn_crawl → fetch nsnlookup → save metadata
    → award_lookup → fetch cage.report → upsert to cage_directory
    → usaspending_awards → paginate USASpending API → upsert to usaspending_awards
  - On success: status="done", completed_at=now(), result={...}
  - On failure:
      if attempts >= max_attempts: status="failed", error_message=...
      else: status="pending" (retry later), attempts+=1
  - Sleep DELAY_MS (2000ms) between jobs
```

## Supabase tables

| Table | R/W | Purpose |
|-------|-----|---------|
| `job_queue` (a.k.a. `background_jobs`) | both | The queue itself |
| `discovered_suppliers` | W | Supplier discovery output |
| `cage_directory` | W | CAGE → company mapping |
| `usaspending_awards` | W | Competitor award data |

`job_queue` schema: `id, job_type, payload (JSON), status, attempts, max_attempts, created_at, started_at, completed_at, result (JSON), error_message`.

## Business invariants

1. **Fair rotation** — processor iterates types `["supplier_discovery", "usaspending_awards", "nsn_crawl", "award_lookup"]` to prevent one type monopolizing capacity.
2. **Batch size = 5 jobs per run** (src/app/api/jobs/process/route.ts:17).
3. **Delay between jobs = 2000ms.**
4. **Max retries** — `job.max_attempts` set at enqueue time. Once exceeded, status becomes `failed` permanently.
5. **Dedup**:
   - Supplier discovery: by domain.
   - USASpending: upsert by `contract_number`.
6. **Timeouts** — external fetches wrapped in 10s `AbortController`.

## Known gaps / TODOs

- **Stuck `processing` jobs** — if Railway dies mid-job, status stays `processing` forever. No timeout cleanup.
- **`failed` jobs never retried** — once exhausted, only manual DB intervention resurrects them.
- **No dead-letter queue** — failed mixed with the rest; no systematic failure tracking.
- **No observability** — stdout only. No Sentry, no Datadog, no alerting.
- **Supplier discovery broken** — DuckDuckGo + Google block Railway IPs (0 results). Needs paid search API or direct supplier-site integration.
- **203 award_lookup jobs stuck pending** (as of recent check). Unclear why — possibly cage.report rate limiting.
- **No backpressure** — queue can grow unbounded. GitHub Actions cron doesn't throttle.
- **No admin UI for queue inspection** — to see stuck jobs, query Supabase directly.

## Referenced files

- `src/app/api/jobs/process/route.ts` — full processor
  - Constants (17-18): BATCH_SIZE=5, DELAY_MS=2000
  - nsn_crawl (26-50)
  - supplier_discovery (52-132)
  - award_lookup (134-155)
  - usaspending_awards (157-226)
  - Main loop (230-317)
- `.github/workflows/job-processor.yml` — cron (every 10 min)
