/** Wiki page registry. Order here is the order shown in the sidebar. */
export const WIKI_PAGES = [
  {
    slug: "overview",
    title: "Overview",
    subtitle: "What DIBS is and why it exists",
  },
  {
    slug: "architecture",
    title: "Architecture",
    subtitle: "How the pieces fit together",
  },
  {
    slug: "data-sources",
    title: "Data Sources",
    subtitle: "LamLinks, AX, DIBBS, PUB LOG, Master DB",
  },
  {
    slug: "pricing-logic",
    title: "Pricing Logic",
    subtitle: "Empirical markup brackets and cost waterfall",
  },
  {
    slug: "bidding-workflow",
    title: "Bidding Workflow",
    subtitle: "Solicitation → Sourceable → Quoted → Submitted",
  },
  {
    slug: "lamlinks-writeback",
    title: "LamLinks Bid Write-Back",
    subtitle: "How DIBS transmits bids to DLA via LamLinks",
  },
  {
    slug: "lamlinks-collision-2026-04-21",
    title: "LamLinks Counter Collision (2026-04-21)",
    subtitle: "Incident retrospective + plan forward",
  },
  {
    slug: "ax-po-writeback",
    title: "AX PO Write-Back",
    subtitle: "Header DMF → poll for PO# → Lines DMF → posted",
  },
  {
    slug: "npi-workflow",
    title: "NPI Workflow (AX new items + add-supplier)",
    subtitle: "How DIBS generates the New Product Import RawData for AX",
  },
  {
    slug: "gotchas",
    title: "Gotchas & War Stories",
    subtitle: "Things that broke and what we learned",
  },
];
