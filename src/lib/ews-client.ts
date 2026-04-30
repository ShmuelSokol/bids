/**
 * EWS (Exchange Web Services) client wrapper for DIBS.
 *
 * Mirrors the masterdb pattern (app/services/email_import_service.py):
 *   - Connect to mail.everreadygroup.com via basic auth (DOMAIN\local format)
 *   - Same Exchange instance, same credentials, same self-signed-cert handling
 *   - Read inbox via filtered queries
 *   - Send mail (Phase 2)
 *
 * Daemon-side ONLY — `mail.everreadygroup.com` is not reachable from Railway.
 * Any code path that imports this file must NOT be reachable from a Next.js
 * request handler running on Railway. Restrict usage to scripts/ only.
 *
 * Env vars (set in .env on GLOVE):
 *   EWS_SERVER       — usually "mail.everreadygroup.com"
 *   EWS_DOMAIN       — NT domain (e.g. "EVERREADY"). Empty = use email as-is.
 *   EWS_USER         — full email of the account to authenticate as
 *   EWS_PASSWORD     — plaintext password (matches the value masterdb stores
 *                      Fernet-encrypted in email_config; keep it in .env, NOT
 *                      committed to git)
 */
import * as ews from "ews-javascript-api";

const {
  ExchangeService, ExchangeVersion, WebCredentials, Uri,
  WellKnownFolderName, ItemView, SearchFilter, EmailMessageSchema,
  PropertySet, BasePropertySet, ItemSchema, BodyType, MessageBody,
  EmailMessage, EmailAddress,
} = ews as any;

export type WawfFetchedEmail = {
  uid: string;          // Exchange item id
  receivedAt: Date;
  subject: string;
  bodyText: string;
  senderEmail: string;
};

let _serviceCache: any = null;

function buildService(): any {
  if (_serviceCache) return _serviceCache;

  const server = process.env.EWS_SERVER || "mail.everreadygroup.com";
  const domain = process.env.EWS_DOMAIN || "";
  const user = process.env.EWS_USER || "";
  const password = process.env.EWS_PASSWORD || "";

  if (!user || !password) {
    throw new Error("EWS_USER and EWS_PASSWORD must be set in .env");
  }

  // Build NTLM-style username if domain provided, else use email as-is.
  // Mirrors masterdb's connect_ews().
  const username = domain
    ? `${domain}\\${user.split("@")[0]}`
    : user;

  const service = new ExchangeService(ExchangeVersion.Exchange2013_SP1);
  service.Credentials = new WebCredentials(username, password);
  service.Url = new Uri(`https://${server}/EWS/Exchange.asmx`);
  service.Timeout = 30000;

  _serviceCache = service;
  return service;
}

/**
 * Reset the cached service. Use after auth errors so the next call re-builds.
 */
export function resetEwsService(): void {
  _serviceCache = null;
}

/**
 * Test the connection. Returns { ok, message }.
 */
export async function testEwsConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const service = buildService();
    const view = new ItemView(1);
    const found = await service.FindItems(WellKnownFolderName.Inbox, view);
    return { ok: true, message: `Connected. Inbox accessible (showing ${found.Items.length} preview items).` };
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes("401") || /unauthor/i.test(msg)) {
      return { ok: false, message: "Authentication failed (401). Check EWS_USER/EWS_PASSWORD/EWS_DOMAIN." };
    }
    if (/timeout|timed out/i.test(msg)) {
      return { ok: false, message: "Connection timed out. Check EWS_SERVER reachability from this machine." };
    }
    return { ok: false, message: `Connection failed: ${msg}` };
  }
}

/**
 * Fetch emails from a specific sender within a lookback window.
 * Mirrors masterdb's fetch_emails_from_sender().
 */
export async function fetchFromSender(
  senderEmail: string,
  lookbackMinutes: number = 60,
  maxItems: number = 100,
): Promise<WawfFetchedEmail[]> {
  const service = buildService();
  const since = new Date(Date.now() - lookbackMinutes * 60_000);

  // Server-side filter: from sender + received after `since`.
  // EWS lib needs ISO string, not Date object; lib internally builds the
  // <t:Constant Value=".."/> XML.
  const filterFromSender = new SearchFilter.IsEqualTo(EmailMessageSchema.From, senderEmail);
  const filterReceivedAfter = new SearchFilter.IsGreaterThan(
    ItemSchema.DateTimeReceived,
    since.toISOString(),
  );
  const filter = new SearchFilter.SearchFilterCollection(
    (ews as any).LogicalOperator.And,
    [filterFromSender, filterReceivedAfter],
  );

  // EWS limitation: Body can't be in FindItem PropertySet. Fetch IDs only,
  // then bulk-load all properties (Subject, DateTime, From, Body) in one
  // LoadPropertiesForItems call (replaces the FindItem propset entirely).
  const view = new ItemView(maxItems);
  view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

  const findResult = await service.FindItems(WellKnownFolderName.Inbox, filter, view);
  if (!findResult.Items || findResult.Items.length === 0) return [];

  const fullPropSet = new PropertySet(BasePropertySet.IdOnly, [
    EmailMessageSchema.Subject,
    EmailMessageSchema.DateTimeReceived,
    EmailMessageSchema.From,
    EmailMessageSchema.Body,
  ]);
  fullPropSet.RequestedBodyType = BodyType.Text;
  await service.LoadPropertiesForItems(findResult.Items, fullPropSet);

  const results: WawfFetchedEmail[] = [];
  for (const item of findResult.Items) {
    const bodyText = item.Body?.Text || (item.Body && item.Body.toString && item.Body.toString()) || "";
    const fromAddr = item.From?.Address || "";
    results.push({
      uid: item.Id?.UniqueId || "",
      receivedAt: item.DateTimeReceived ? new Date(item.DateTimeReceived) : new Date(),
      subject: item.Subject || "",
      bodyText: typeof bodyText === "string" ? bodyText : String(bodyText),
      senderEmail: fromAddr,
    });
  }
  return results;
}

export type SentEmail = {
  uid: string;
  sentAt: Date;
  subject: string;
  bodyText: string;
  toRecipients: string[];
  ccRecipients: string[];
};

export type EmailContact = {
  email: string;
  displayName: string;
  domain: string;
  asSender: number;     // count of emails received from this address
  asRecipient: number;  // count of emails Abe sent to this address
  lastSeen: Date;
  bodySnippet?: string; // first ~500 chars of most recent message body
};

/**
 * Pull contacts (email + display name + counts) from a folder for the
 * last N days. Unlike fetchFromFolder, this is OPTIMIZED FOR HEADERS —
 * doesn't pull full body. Used by supplier discovery to mine the user's
 * inbox/sent for known supplier contacts.
 */
export async function harvestContactsFromFolder(opts: {
  folder: "inbox" | "sentitems";
  lookbackDays: number;
  pageSize?: number;
  maxPages?: number;
}): Promise<Map<string, EmailContact>> {
  const service = buildService();
  const pageSize = opts.pageSize ?? 500;
  const maxPages = opts.maxPages ?? 100; // cap at 50K emails per folder
  const since = new Date(Date.now() - opts.lookbackDays * 24 * 60 * 60_000);
  const folder = opts.folder === "sentitems"
    ? WellKnownFolderName.SentItems
    : WellKnownFolderName.Inbox;
  const dateField = opts.folder === "sentitems"
    ? ItemSchema.DateTimeSent
    : ItemSchema.DateTimeReceived;
  const isSent = opts.folder === "sentitems";

  const filter = new SearchFilter.IsGreaterThan(dateField, since.toISOString());
  const contacts = new Map<string, EmailContact>();

  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    const view = new ItemView(pageSize, offset);
    view.PropertySet = new PropertySet(BasePropertySet.IdOnly);
    const findResult = await service.FindItems(folder, filter, view);
    if (!findResult.Items || findResult.Items.length === 0) break;

    // Bulk-load just the headers we need
    const propSet = new PropertySet(BasePropertySet.IdOnly, [
      EmailMessageSchema.Subject,
      EmailMessageSchema.DateTimeSent,
      EmailMessageSchema.DateTimeReceived,
      EmailMessageSchema.From,
      EmailMessageSchema.ToRecipients,
      EmailMessageSchema.CcRecipients,
    ]);
    await service.LoadPropertiesForItems(findResult.Items, propSet);

    const extractAddrs = (coll: any): { email: string; name: string }[] => {
      if (!coll) return [];
      const items = coll.Items || coll.items || coll;
      const out: { email: string; name: string }[] = [];
      try {
        for (const r of items) {
          const addr = r?.Address || r?.address;
          const name = r?.Name || r?.name || "";
          if (addr) out.push({ email: addr.toLowerCase(), name });
        }
      } catch { /* */ }
      return out;
    };

    for (const item of findResult.Items) {
      const when = (item.DateTimeSent || item.DateTimeReceived) ? new Date(item.DateTimeSent || item.DateTimeReceived) : new Date();

      // Process the From and the To/Cc set
      const allParties: { email: string; name: string; role: "from" | "to" }[] = [];
      const fromAddr = item.From?.Address;
      const fromName = item.From?.Name || "";
      if (fromAddr) allParties.push({ email: String(fromAddr).toLowerCase(), name: fromName, role: "from" });
      for (const r of extractAddrs(item.ToRecipients)) allParties.push({ ...r, role: "to" });
      for (const r of extractAddrs(item.CcRecipients)) allParties.push({ ...r, role: "to" });

      for (const p of allParties) {
        if (!p.email || !p.email.includes("@")) continue;
        const domain = p.email.split("@")[1];
        let c = contacts.get(p.email);
        if (!c) {
          c = {
            email: p.email,
            displayName: p.name || "",
            domain,
            asSender: 0,
            asRecipient: 0,
            lastSeen: when,
          };
          contacts.set(p.email, c);
        }
        // Update display name if we have a better (longer/non-empty) one
        if (p.name && p.name.length > c.displayName.length) c.displayName = p.name;
        // Update lastSeen
        if (when > c.lastSeen) c.lastSeen = when;
        // Count direction
        if (isSent) {
          if (p.role === "to") c.asRecipient++;
          // (sender is us in sent items, so skip)
        } else {
          if (p.role === "from") c.asSender++;
          // (recipients are us in inbox, so skip)
        }
      }
    }

    offset += pageSize;
    if (findResult.Items.length < pageSize) break;
  }

  return contacts;
}

/**
 * Fetch emails from a folder (Inbox / SentItems / etc.) within a lookback
 * window, optionally filtered by subject keywords. Used by the RFQ
 * tone-learning pass: pull the user's outbound RFQs for analysis.
 */
export async function fetchFromFolder(opts: {
  folder: "inbox" | "sentitems";
  lookbackDays?: number;          // default 90
  maxItems?: number;              // default 200
  subjectContains?: string[];     // OR-match — at least one keyword in subject
}): Promise<SentEmail[]> {
  const service = buildService();
  const lookbackDays = opts.lookbackDays ?? 90;
  const maxItems = opts.maxItems ?? 200;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60_000);
  const folder = opts.folder === "sentitems"
    ? WellKnownFolderName.SentItems
    : WellKnownFolderName.Inbox;
  const dateField = opts.folder === "sentitems"
    ? ItemSchema.DateTimeSent
    : ItemSchema.DateTimeReceived;

  // Date filter only — keyword filter applied client-side after fetch
  // because EWS subject-substring filtering is awkward with multi-keyword OR
  const filter = new SearchFilter.IsGreaterThan(dateField, since.toISOString());

  const view = new ItemView(maxItems);
  view.PropertySet = new PropertySet(BasePropertySet.IdOnly);
  const findResult = await service.FindItems(folder, filter, view);
  if (!findResult.Items || findResult.Items.length === 0) return [];

  const fullPropSet = new PropertySet(BasePropertySet.IdOnly, [
    EmailMessageSchema.Subject,
    EmailMessageSchema.DateTimeSent,
    EmailMessageSchema.DateTimeReceived,
    EmailMessageSchema.ToRecipients,
    EmailMessageSchema.CcRecipients,
    EmailMessageSchema.Body,
  ]);
  fullPropSet.RequestedBodyType = BodyType.Text;
  await service.LoadPropertiesForItems(findResult.Items, fullPropSet);

  const results: SentEmail[] = [];
  for (const item of findResult.Items) {
    const subject = item.Subject || "";
    if (opts.subjectContains && opts.subjectContains.length > 0) {
      const lower = subject.toLowerCase();
      const matched = opts.subjectContains.some((kw) => lower.includes(kw.toLowerCase()));
      if (!matched) continue;
    }
    const bodyText = item.Body?.Text || (item.Body && item.Body.toString && item.Body.toString()) || "";
    // ToRecipients/CcRecipients are EmailAddressCollection — try the
    // documented .Items accessor first, fall back to direct iteration
    const extractAddrs = (coll: any): string[] => {
      if (!coll) return [];
      const items = coll.Items || coll.items || coll;
      const out: string[] = [];
      try {
        for (const r of items) {
          const addr = r?.Address || r?.address || r?.EmailAddress?.Address;
          if (addr) out.push(addr);
        }
      } catch { /* */ }
      return out;
    };
    const to = extractAddrs(item.ToRecipients);
    const cc = extractAddrs(item.CcRecipients);

    results.push({
      uid: item.Id?.UniqueId || "",
      sentAt: item.DateTimeSent
        ? new Date(item.DateTimeSent)
        : item.DateTimeReceived ? new Date(item.DateTimeReceived) : new Date(),
      subject,
      bodyText: typeof bodyText === "string" ? bodyText : String(bodyText),
      toRecipients: to,
      ccRecipients: cc,
    });
  }
  return results;
}

/**
 * Send an email (Phase 2 — RFQ outbound, etc.).
 * Plain-text body, single recipient. Multi-recipient + HTML in next iteration.
 */
export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string[];
  bodyType?: "text" | "html";
}): Promise<void> {
  const service = buildService();
  const message = new EmailMessage(service);
  message.Subject = opts.subject;
  message.Body = new MessageBody(
    opts.bodyType === "html" ? BodyType.HTML : BodyType.Text,
    opts.body,
  );
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  for (const r of recipients) {
    message.ToRecipients.Add(new EmailAddress(r));
  }
  for (const r of opts.cc || []) {
    message.CcRecipients.Add(new EmailAddress(r));
  }
  await message.SendAndSaveCopy();
}
