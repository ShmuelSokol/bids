# Flow Specifications

> **Pass 1 of the document-then-audit workflow.** Each file here is a reverse-spec
> for a user-facing flow — routes, states, buttons, API endpoints, tables touched,
> business invariants, and known gaps. The companion `AUDIT.md` cross-references
> these specs against the actual code to surface dead code, duplicated logic, and
> contradictions.

## Why this exists

LLMs are much better at comparing two artifacts (spec vs. code) than at holding
an implicit mental model of a large system across a single cold read. By writing
the spec first and then diffing against reality in a separate pass, we catch
bugs that a direct "audit my code" pass would miss.

This isn't documentation for humans (that's `/wiki` and `docs/*.md` at the level
above). It's a precise, structured spec keyed to file:line references that a
future audit pass (human or Claude) can diff against.

## Files

- [bidding.md](./bidding.md) — Sourceable → Quoted → Submitted flow
- [scraping.md](./scraping.md) — DIBBS scraper + LamLinks sync
- [enrichment.md](./enrichment.md) — NSN matching + pricing engine
- [awards-to-pos.md](./awards-to-pos.md) — Award import → PO generation → supplier switch
- [invoicing.md](./invoicing.md) — EDI 810 generation, remittance import
- [shipping.md](./shipping.md) — Shipment sync from LamLinks
- [auth.md](./auth.md) — Login, middleware, role gating
- [background-jobs.md](./background-jobs.md) — Job processor
- [analytics.md](./analytics.md) — Win/loss analytics
- [AUDIT.md](./AUDIT.md) — Pass 2 findings

## Structure of each spec

Every flow file follows the same structure so the audit pass has consistent
keys to compare:

1. **Entry points** — URLs, sidebar links, external triggers
2. **State machine** — enumerated states and the transitions between them
3. **User actions** — every button/form and what it does
4. **API routes** — every endpoint involved in this flow
5. **Supabase tables** — read/written columns
6. **External systems** — what we call and with what auth
7. **Business invariants** — rules that must always hold
8. **Known gaps / TODOs** — things we know are missing or wrong
