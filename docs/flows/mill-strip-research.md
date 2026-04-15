# Mill Strip / WAWF Tracking Passthrough — research

**Status**: research / not built. Raised in the 2026-04-15 Yosef+Abe meeting.

## Problem

When we ship DLA orders, the government's receiving-end contracting officers frequently email Abe asking for a POD (proof of delivery). Abe has to manually dig the tracking number, pull the PDF, email it back. This is a significant daily time sink — Yosef said "would cut down a lot of emails I get."

The root issue is that **WAWF's Receiving Report (DD-250) doesn't carry the carrier tracking number back to the receiving depot**. The receiver sees the PO but has no way to look up where the package is without asking us.

## What "Mill Strip" is

In Yosef's words (transcript): *"there is a feature in WAF, it's called Mill Strip where you have the option government gives you the option to basically when you do invoicing, put in the tracking number."*

This appears to reference **WAWF's ability to attach supplemental shipping information via a "mill strip" record** on the RR/Invoice. The mill strip captures carrier + tracking so DLA's receiving side can look it up automatically, skipping the email-Abe dance.

## What we know

- LamLinks UI has a **tracking number field on the invoice line** — but it does NOT transmit that field to WAWF on the current EDI path. That was confirmed in the meeting. So even when warehouse knows the tracking #, it doesn't make it to the government.
- Yosef spoke to Colin (the LamLinks owner) about this; Colin's response was essentially sympathetic but no fix planned.
- Abe deals with this manually today — one email per POD request.

## What to research

1. **Does WAWF accept tracking # as a field on 810/856?** The EDI X12 transaction for RR+Invoice does have a BOL / carrier / tracking slot (`TD3`, `REF*CN`, or similar). Need to confirm which segment and whether DLA's WAWF receiver parses it.
2. **Is there an API into WAWF?** Mil-Pac VAN currently accepts EDI via SFTP. Is there a REST/SOAP endpoint that would accept a "mill strip update" post-invoice? Worth checking the iRAPT / WAWF developer docs.
3. **Would DLA parse a mill strip if we submitted one?** Even if the protocol supports it, the receiving side may not consume it. Need to ask DLA directly (or ping the contracting officers who ask Abe for PODs — they'd know).
4. **What does LamLinks put in its tracking field today?** If it's populated but silently dropped on EDI output, the fix is probably on Colin's side — adding `TD3` or equivalent to the 810 output. Might be a LamLinks feature request, not a DIBS build.

## What DIBS could do

- **Short term** (no Mill Strip): on `/invoicing`, surface the tracking number prominently next to each invoice so Abe can copy-paste it into his POD-request replies faster. Reduces email time from "minutes per" to "seconds per."
- **Medium term**: if LamLinks' invoice EDI output could accept a tracking field, DIBS could feed it in during the invoice-write-back phase. Requires Colin's buy-in.
- **Long term**: if WAWF has an API we can write against directly, DIBS could post tracking post-shipment without touching LamLinks. That's its own significant integration project.

## Questions to ask Yosef / Colin / DLA

- (Yosef/Colin) In LamLinks' current EDI 810 output to WAWF, which X12 segments get populated? Is `TD3` or `REF*CN` ever emitted?
- (Yosef) Is there a LamLinks UI toggle or config that enables tracking # passthrough that just isn't turned on for us?
- (Abe) How many POD-request emails per day / week? (size the problem)
- (DLA, via contracting officer relationships) Would the receiving side consume a tracking # if we included it? Is there a preferred delivery channel (EDI / API / email addendum)?

## Referenced files

- `src/app/invoicing/` — the current EDI 810 generator. Tracking # isn't on the output today.
- `src/lib/edi-generator.ts` — X12 builder. Search for "TD3" / "REF*CN" — not present.
