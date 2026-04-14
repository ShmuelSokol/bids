# DIBS Knowledge Base

> **This is a knowledge base for future Claude Code sessions working on DIBS.**
> Not human-facing docs. Human-facing versions of the same content render at `/wiki` in the app.

When you pick up work on this project, read the relevant pages before making changes.
These capture hard-won context that isn't in the code: why decisions were made, what
we tried that didn't work, and subtle gotchas that took days to track down.

## Pages

| File | When to read it |
|------|----------------|
| [overview.md](./overview.md) | First time touching the project. Explains what DIBS is, who uses it, and how the three data loops fit together. |
| [architecture.md](./architecture.md) | Before adding a new integration, deployment change, or API route. Explains Railway/Supabase/GitHub Actions boundaries. |
| [data-sources.md](./data-sources.md) | Before touching any scraper, importer, or NSN-matching code. Full field guide to LamLinks, AX, DIBBS, PUB LOG, and Master DB. |
| [pricing-logic.md](./pricing-logic.md) | Before changing suggested-price computation, markup brackets, or cost waterfall. Empirical model fit from 2,591 bid matches. |
| [bidding-workflow.md](./bidding-workflow.md) | Before changing the solicitations UI, bid states, or Abe's daily flow. |
| [gotchas.md](./gotchas.md) | **Read this first when something inexplicably breaks.** Supabase 1K limit, DIBBS consent cookies, timezone bugs, native-package Railway crashes, etc. |

## How to update

When you learn something new about the system that a future session would benefit from:

1. **Is it a general fact?** Add to the appropriate page in this folder.
2. **Is it a gotcha?** Add to `gotchas.md` with symptom → cause → fix structure.
3. **Does it affect the source of truth elsewhere?** Also update `CLAUDE.md` / `AGENTS.md` at the repo root if it's a rule that must be followed.

These pages are also rendered in the app at `/wiki`, so keep them markdown-compatible
and narrative. The audience is someone (future Claude or a new human teammate) who
needs to understand the *why*, not just the *what*.

## What this is NOT

- Not API documentation. Read the code.
- Not commit history. `git log` has that.
- Not runtime docs for end users. Abe doesn't read this.
