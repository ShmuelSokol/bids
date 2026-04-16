import "./env";
async function main() {
  console.log("Triggering enrichment...");
  let total = 0;
  for (let i = 0; i < 15; i++) {
    const r = await fetch("https://dibs-gov-production.up.railway.app/api/dibbs/enrich");
    const d: any = await r.json();
    console.log(`  Run ${i + 1}: checked=${d.total_checked} sourceable=${d.sourceable} remaining=${d.remaining}`);
    total += d.sourceable || 0;
    if (!d.remaining || d.remaining <= 0) break;
  }
  console.log(`\nTotal new sourceable: ${total}`);
}
main();
