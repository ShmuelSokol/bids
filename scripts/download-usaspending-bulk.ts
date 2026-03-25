/**
 * Poll USASpending bulk download status and download when ready.
 * Then extract and parse the CSV for analysis.
 */
import { writeFileSync, mkdirSync, createWriteStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const OUTPUT_DIR = join(__dirname, "..", "data", "usaspending");
const STATUS_URL =
  "https://api.usaspending.gov/api/v2/download/status/?file_name=All_PrimeTransactions_2026-03-25_H17M01S06423716.zip";
const FILE_URL =
  "https://files.usaspending.gov/generated_downloads/All_PrimeTransactions_2026-03-25_H17M01S06423716.zip";

async function pollUntilReady(): Promise<void> {
  while (true) {
    const resp = await fetch(STATUS_URL);
    const data = await resp.json();
    console.log(
      `Status: ${data.status} | Elapsed: ${Math.round(data.seconds_elapsed)}s | Rows: ${data.total_rows || "?"} | Size: ${data.total_size || "?"}`
    );

    if (data.status === "finished") {
      console.log("\nDownload ready!");
      return;
    }
    if (data.status === "failed") {
      throw new Error("Bulk download failed: " + data.message);
    }

    await new Promise((r) => setTimeout(r, 10000));
  }
}

async function downloadFile(): Promise<string> {
  const outPath = join(OUTPUT_DIR, "dla-awards-bulk.zip");
  console.log(`Downloading from ${FILE_URL}...`);

  const resp = await fetch(FILE_URL);
  if (!resp.ok || !resp.body) {
    throw new Error(`Download failed: ${resp.status}`);
  }

  const fileStream = createWriteStream(outPath);
  await pipeline(Readable.fromWeb(resp.body as any), fileStream);
  console.log(`Saved to ${outPath}`);
  return outPath;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Polling for bulk download completion...\n");
  await pollUntilReady();
  await downloadFile();

  console.log("\nDone! Extract the zip and parse the CSV next.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
