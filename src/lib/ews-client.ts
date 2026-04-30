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

  // Server-side filter: from sender + received after `since`
  const filterFromSender = new SearchFilter.IsEqualTo(EmailMessageSchema.From, senderEmail);
  const filterReceivedAfter = new SearchFilter.IsGreaterThan(ItemSchema.DateTimeReceived, since);
  const filter = new SearchFilter.SearchFilterCollection(
    (ews as any).LogicalOperator.And,
    [filterFromSender, filterReceivedAfter],
  );

  const view = new ItemView(maxItems);
  view.PropertySet = new PropertySet(BasePropertySet.IdOnly, [
    EmailMessageSchema.Subject,
    EmailMessageSchema.DateTimeReceived,
    EmailMessageSchema.From,
    EmailMessageSchema.Body,
  ]);
  view.PropertySet.RequestedBodyType = BodyType.Text;

  const findResult = await service.FindItems(WellKnownFolderName.Inbox, filter, view);

  const results: WawfFetchedEmail[] = [];
  for (const item of findResult.Items) {
    // Body comes back as MessageBody; need .ToString() in EWS managed API land
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
