/**
 * EDI File Watcher
 *
 * Watches a configured folder for new EDI files from Lamlinks.
 * Parses each file and loads into the database.
 *
 * Expected flow:
 * 1. Abe re-enables EDI file forwarding in Lamlinks
 * 2. Files land in a folder (e.g., C:\LamlinksEDI\incoming)
 * 3. This watcher detects new files
 * 4. Parser extracts solicitations (840), awards (836/850)
 * 5. Data loaded into PostgreSQL via Prisma
 * 6. Processed files moved to /processed subfolder
 */

import { promises as fs } from "fs";
import path from "path";
import { parseEdiRaw, parseOrder, parseSolicitation } from "./edi-parser";

export interface WatcherConfig {
  incomingDir: string;       // e.g., C:\LamlinksEDI\incoming
  processedDir: string;      // e.g., C:\LamlinksEDI\processed
  errorDir: string;          // e.g., C:\LamlinksEDI\errors
  filePattern: string;       // e.g., "*.edi" or "*.x12"
  pollIntervalMs: number;    // e.g., 30000 (30 seconds)
}

export interface WatcherResult {
  filesProcessed: number;
  filesErrored: number;
  solicitationsFound: number;
  ordersFound: number;
  errors: string[];
}

const DEFAULT_CONFIG: WatcherConfig = {
  incomingDir: "C:\\LamlinksEDI\\incoming",
  processedDir: "C:\\LamlinksEDI\\processed",
  errorDir: "C:\\LamlinksEDI\\errors",
  filePattern: ".edi",
  pollIntervalMs: 30000,
};

/**
 * Scan the incoming directory for new EDI files and process them
 */
export async function scanAndProcessEdiFiles(
  config: WatcherConfig = DEFAULT_CONFIG
): Promise<WatcherResult> {
  const result: WatcherResult = {
    filesProcessed: 0,
    filesErrored: 0,
    solicitationsFound: 0,
    ordersFound: 0,
    errors: [],
  };

  // Ensure directories exist
  await fs.mkdir(config.processedDir, { recursive: true }).catch(() => {});
  await fs.mkdir(config.errorDir, { recursive: true }).catch(() => {});

  let files: string[];
  try {
    const allFiles = await fs.readdir(config.incomingDir);
    files = allFiles.filter(f =>
      f.toLowerCase().endsWith(config.filePattern) ||
      f.toLowerCase().endsWith(".x12") ||
      f.toLowerCase().endsWith(".txt")
    );
  } catch (err) {
    result.errors.push(`Cannot read directory ${config.incomingDir}: ${err}`);
    return result;
  }

  for (const filename of files) {
    const filepath = path.join(config.incomingDir, filename);

    try {
      const content = await fs.readFile(filepath, "utf-8");
      const doc = parseEdiRaw(content);

      if (!doc) {
        result.errors.push(`${filename}: Could not parse EDI envelope`);
        await moveFile(filepath, path.join(config.errorDir, filename));
        result.filesErrored++;
        continue;
      }

      switch (doc.type) {
        case "840": {
          const solicitation = parseSolicitation(doc);
          if (solicitation) {
            result.solicitationsFound++;
            // In production: await prisma.solicitation.upsert(...)
          }
          break;
        }
        case "850": {
          const order = parseOrder(doc);
          if (order) {
            result.ordersFound++;
            // In production: await prisma.contract.upsert(...)
          }
          break;
        }
        case "836": {
          // Award notice — extract award data
          result.ordersFound++;
          break;
        }
        default:
          result.errors.push(`${filename}: Unsupported transaction type ${doc.type}`);
      }

      // Move to processed
      await moveFile(filepath, path.join(config.processedDir, filename));
      result.filesProcessed++;
    } catch (err) {
      result.errors.push(`${filename}: ${err}`);
      await moveFile(filepath, path.join(config.errorDir, filename)).catch(() => {});
      result.filesErrored++;
    }
  }

  return result;
}

async function moveFile(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch {
    // If rename fails (cross-device), copy and delete
    await fs.copyFile(from, to);
    await fs.unlink(from);
  }
}

/**
 * Get status of the EDI watcher directories
 */
export async function getWatcherStatus(config: WatcherConfig = DEFAULT_CONFIG) {
  const countFiles = async (dir: string) => {
    try {
      const files = await fs.readdir(dir);
      return files.length;
    } catch {
      return -1; // directory doesn't exist
    }
  };

  return {
    incomingDir: config.incomingDir,
    processedDir: config.processedDir,
    errorDir: config.errorDir,
    pendingFiles: await countFiles(config.incomingDir),
    processedFiles: await countFiles(config.processedDir),
    errorFiles: await countFiles(config.errorDir),
    pollIntervalMs: config.pollIntervalMs,
  };
}
