/**
 * Local poll-ax runner for Windows Task Scheduler.
 * Calls the Railway-hosted /api/orders/poll-ax route so the AX OData
 * lookup runs server-side (where the service principal creds live).
 *
 * Used by the scheduled task "DIBS - AX PO Poll" (every 5 min).
 */
import "./env";

async function main() {
  const URL_BASE = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://dibs-gov-production.up.railway.app";
  const INTERNAL_SECRET = process.env.INTERNAL_POLL_SECRET;

  const resp = await fetch(`${URL_BASE}/api/orders/poll-ax`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INTERNAL_SECRET ? { "X-Internal-Secret": INTERNAL_SECRET } : {}),
    },
    body: JSON.stringify({}),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`poll-ax HTTP ${resp.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  try {
    const data = JSON.parse(text);
    console.log(`poll-ax: checked=${data.checked || 0} updated=${data.updated || 0}`);
    if (data.pos?.length) {
      for (const p of data.pos) console.log(`  po=${p.id} ${p.from || ""}→${p.to || ""} ${p.ax_po_number || ""}`);
    }
  } catch {
    console.log("poll-ax raw:", text.slice(0, 300));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
