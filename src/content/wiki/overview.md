# Overview

> *"This isn't a bidding system. It's an intelligence layer that sits on top of one."*

## What DIBS actually is

Ever Ready First Aid (CAGE 0AG09) does roughly **$8–9M/year in government business** — about 500 orders a week. The entire bidding operation has historically run through **LamLinks**, a third-party bid-management tool that Abe Joseph uses to submit ~50 bids a day. LamLinks tells you *what* is out there. It doesn't tell you what's worth bidding on, what price to bid at, or how to cover the 200+ FSCs (Federal Supply Classes) LamLinks doesn't subscribe to.

**DIBS is the layer that answers those questions.** It pulls solicitations from LamLinks, scrapes DIBBS directly for everything LamLinks misses, enriches every item with NSN matches from our AX/D365 system, looks up historical pricing from our own wins and losses, and hands Abe a pre-sorted list of "here's what to bid on today, and here's what to bid."

It also does things LamLinks can't do at all: supplier switching (finding cheaper vendors per NSN), P/N matching against PUB LOG to source items that don't match on NSN, win/loss analytics across 74,000+ awards, automated daily scraping, and a daily WhatsApp briefing.

## Why this exists

Three problems made a custom layer worth building:

1. **LamLinks only covers 240 FSCs.** DLA buys in ~464 FSCs. We were blind to half the market.
2. **Abe's pricing was tribal knowledge.** The "right" bid was what he remembered, what he could find in an Excel spreadsheet, or what he guessed. We lost bids by pricing too high; we left money on the table by pricing too low. An empirical pricing engine built from 2,591 bid-to-cost matches is a massive improvement over instinct.
3. **Nothing downstream was connected.** Solicitations, awards, shipments, invoices, and POs all lived in different systems with no cross-reference. DIBS is the connective tissue.

## The 30-second mental model

```
┌─────────────────────────────────────────────────────────────┐
│                        DIBS                                 │
│                                                             │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐        │
│   │  Scrape    │───▶│  Enrich    │───▶│  Present   │        │
│   │  (DIBBS)   │    │  (AX/LL)   │    │  to Abe    │        │
│   └────────────┘    └────────────┘    └────────────┘        │
│         ▲                ▲                  │               │
│         │                │                  ▼               │
│   ┌────────────┐   ┌────────────┐    ┌────────────┐         │
│   │  LamLinks  │   │  Master DB │    │  Submit    │         │
│   │  (import)  │   │   PUB LOG  │    │  (future)  │         │
│   └────────────┘   └────────────┘    └────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

There are three loops running:

- **Daily DIBBS scrape** (6am + 12pm ET via GitHub Actions) — pulls new solicitations from FSCs that LamLinks doesn't cover.
- **LamLinks sync** — imports solicitations, awards, and Abe's live bids from the local SQL Server.
- **Enrichment cycle** — for every new solicitation, try to match the NSN against AX first, then Master DB. Apply pricing logic. Flag as `sourceable` or not.

That's the whole system, one level down. The rest is wiring and UI.

## Who uses this

- **Abe Joseph** (ajoseph@everreadygroup.com) — military bidder, ~50 bids/day. Primary user. His daily flow is `Dashboard → Solicitations → review suggested prices → Quote → Batch Submit`.
- **Yosef Schapiro** (yschapiro@everreadygroup.com) — D365/AX + LamLinks admin. Gatekeeper for any writes to LamLinks (we stay READ ONLY until he verifies the schema relationships).
- **M Perl** — supplier/purchasing side.
- **Shmuel Sokol** — project lead.

## What DIBS is not

- **Not a replacement for LamLinks.** Abe still submits bids in LamLinks. DIBS tells him what to submit and at what price. Bid submission *automation* is a future project blocked on Yosef's verification of the k33/k34/k35 chain.
- **Not a CRM.** We don't track customers (there's one: DLA). We don't track sales pipeline in the traditional sense.
- **Not a forecast.** DIBS is *reactive* — it tells you what's out there right now. It doesn't predict future demand (though the `usaspending_awards` table plus `fsc_heatmap` is the seed for one).

## Where to go next

- [**Architecture**](/wiki/architecture) — the actual stack, deployment, and data flow
- [**Data Sources**](/wiki/data-sources) — deep dive on every integration
- [**Pricing Logic**](/wiki/pricing-logic) — the empirical markup model
- [**Bidding Workflow**](/wiki/bidding-workflow) — Abe's daily flow, step by step
- [**Gotchas**](/wiki/gotchas) — everything that broke and what we learned
