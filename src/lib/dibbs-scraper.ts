/**
 * DIBBS Website Scraper
 *
 * Scrapes dibbs.bsm.dla.mil for solicitation and award data.
 * DIBBS is an ASP.NET WebForms app with ViewState — requires
 * a real browser (Playwright) to navigate.
 *
 * WARNING: This is fragile. DIBBS UI changes will break it.
 * This is a stopgap until we get Lam Links SQL access or their API.
 *
 * Capabilities:
 * - Login with DoD consent banner acceptance
 * - Search solicitations by FSC code
 * - Search awards by cage code
 * - Download batch quote file (CSV)
 * - Pull procurement history for specific NSNs
 */

// Playwright is optional — only available when installed locally
type Browser = any;
type Page = any;
function getPlaywright() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(/* webpackIgnore: true */ "playwright").chromium;
  } catch {
    throw new Error("Playwright is not installed. Run: npm install playwright");
  }
}

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";

export interface DibbsCredentials {
  username: string;
  password: string;
}

export interface DibbsSolicitation {
  solicitationNumber: string;
  nsn: string;
  itemDescription: string;
  quantity: number;
  unitOfMeasure: string;
  closingDate: string;
  fscCode: string;
  status: string;
}

export interface DibbsAward {
  contractNumber: string;
  solicitationNumber: string;
  nsn: string;
  itemDescription: string;
  awardDate: string;
  winnerCageCode: string;
  winnerName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}

export interface ScrapeResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  scrapedAt: string;
  duration: number;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    const pw = await getPlaywright();
    browser = await pw.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

/**
 * Login to DIBBS — handles the DoD consent banner
 */
async function loginToDibbs(page: Page, creds: DibbsCredentials): Promise<boolean> {
  try {
    await page.goto(DIBBS_BASE, { waitUntil: "networkidle", timeout: 30000 });

    // Accept DoD consent banner if present
    const consentButton = page.locator('input[type="submit"][value*="Accept"], input[type="submit"][value*="I Accept"], button:has-text("Accept"), input[value*="ACCEPT"]');
    if (await consentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await consentButton.click();
      await page.waitForLoadState("networkidle");
    }

    // Look for login form
    const usernameField = page.locator('input[name*="UserName"], input[name*="username"], input[id*="UserName"], input[type="text"]').first();
    const passwordField = page.locator('input[name*="Password"], input[name*="password"], input[id*="Password"], input[type="password"]').first();
    const loginButton = page.locator('input[type="submit"][value*="Log"], input[type="submit"][value*="Sign"], button:has-text("Log In"), button:has-text("Sign In")').first();

    if (await usernameField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usernameField.fill(creds.username);
      await passwordField.fill(creds.password);
      await loginButton.click();
      await page.waitForLoadState("networkidle");
    }

    // Check if we're logged in (look for Welcome page indicators)
    const isLoggedIn = await page.locator('text=Welcome, text=Solicitation, text=My Account, a:has-text("Home")').first()
      .isVisible({ timeout: 10000 }).catch(() => false);

    return isLoggedIn;
  } catch (err) {
    return false;
  }
}

/**
 * Search solicitations by FSC code on DIBBS
 */
export async function scrapeSolicitations(
  creds: DibbsCredentials,
  fscCodes: string[]
): Promise<ScrapeResult<DibbsSolicitation>> {
  const startTime = Date.now();
  const allSolicitations: DibbsSolicitation[] = [];
  const errors: string[] = [];

  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    const loggedIn = await loginToDibbs(page, creds);
    if (!loggedIn) {
      errors.push("Failed to log into DIBBS. Check credentials.");
      return { success: false, data: [], errors, scrapedAt: new Date().toISOString(), duration: Date.now() - startTime };
    }

    for (const fsc of fscCodes) {
      try {
        // Navigate to solicitation search
        // DIBBS has a "Custom Queries" box on the home page
        await page.goto(`${DIBBS_BASE}/RFQ/RfqRec.aspx`, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});

        // Try the search form — look for FSC/NSN search field
        const searchField = page.locator('input[name*="SearchText"], input[name*="txtSearch"], input[name*="FSC"], input[id*="Search"]').first();
        const scopeDropdown = page.locator('select[name*="Scope"], select[name*="ddlScope"], select[id*="Scope"]').first();
        const searchButton = page.locator('input[type="submit"][value*="Search"], input[type="submit"][value*="Go"], button:has-text("Search")').first();

        if (await searchField.isVisible({ timeout: 5000 }).catch(() => false)) {
          // Set scope to FSC if dropdown exists
          if (await scopeDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Try common FSC-related option labels
            await scopeDropdown.selectOption({ label: "FSC" }).catch(() =>
              scopeDropdown.selectOption({ label: "Federal Supply Class" }).catch(() => {})
            );
          }

          await searchField.fill(fsc);
          await searchButton.click();
          await page.waitForLoadState("networkidle");

          // Parse results table
          const rows = page.locator('table.DataGrid tr, table[id*="grid"] tr, table[id*="Grid"] tr, table.GridView tr').all();
          const rowElements = await rows;

          for (let i = 1; i < rowElements.length; i++) { // skip header
            try {
              const cells = await rowElements[i].locator("td").allTextContents();
              if (cells.length >= 4) {
                allSolicitations.push({
                  solicitationNumber: cells[0]?.trim() || "",
                  nsn: cells[1]?.trim() || "",
                  itemDescription: cells[2]?.trim() || "",
                  quantity: parseInt(cells[3]?.trim() || "0", 10),
                  unitOfMeasure: cells[4]?.trim() || "EA",
                  closingDate: cells[5]?.trim() || "",
                  fscCode: fsc,
                  status: "OPEN",
                });
              }
            } catch {
              // Skip unparseable rows
            }
          }
        } else {
          errors.push(`FSC ${fsc}: Could not find search form`);
        }

        // Rate limiting — don't hammer DIBBS
        await page.waitForTimeout(2000);
      } catch (err) {
        errors.push(`FSC ${fsc}: ${err}`);
      }
    }
  } finally {
    await context.close();
  }

  return {
    success: errors.length === 0,
    data: allSolicitations,
    errors,
    scrapedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
}

/**
 * Search awards by cage code on DIBBS
 */
export async function scrapeAwards(
  creds: DibbsCredentials,
  cageCode: string,
  days: number = 15
): Promise<ScrapeResult<DibbsAward>> {
  const startTime = Date.now();
  const awards: DibbsAward[] = [];
  const errors: string[] = [];

  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    const loggedIn = await loginToDibbs(page, creds);
    if (!loggedIn) {
      errors.push("Failed to log into DIBBS");
      return { success: false, data: [], errors, scrapedAt: new Date().toISOString(), duration: Date.now() - startTime };
    }

    // Navigate to awards search
    // DIBBS awards can be searched from the main page
    const searchField = page.locator('input[name*="SearchText"], input[name*="txtSearch"]').first();
    const scopeDropdown = page.locator('select[name*="Scope"], select[name*="ddlScope"]').first();
    const searchButton = page.locator('input[type="submit"][value*="Search"], input[type="submit"][value*="Go"]').first();

    if (await searchField.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set scope to CAGE code
      if (await scopeDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await scopeDropdown.selectOption({ label: "CAGE" }).catch(() =>
          scopeDropdown.selectOption({ label: "Vendor" }).catch(() =>
            scopeDropdown.selectOption({ label: "CAGE Code" }).catch(() => {})
          )
        );
      }

      await searchField.fill(cageCode);
      await searchButton.click();
      await page.waitForLoadState("networkidle");

      // Parse awards table
      const rows = page.locator('table.DataGrid tr, table[id*="grid"] tr, table[id*="Grid"] tr').all();
      const rowElements = await rows;

      for (let i = 1; i < rowElements.length; i++) {
        try {
          const cells = await rowElements[i].locator("td").allTextContents();
          if (cells.length >= 5) {
            const unitPrice = parseFloat(cells[5]?.replace(/[$,]/g, "") || "0");
            const qty = parseInt(cells[4]?.trim() || "0", 10);
            awards.push({
              contractNumber: cells[0]?.trim() || "",
              solicitationNumber: cells[1]?.trim() || "",
              nsn: cells[2]?.trim() || "",
              itemDescription: cells[3]?.trim() || "",
              awardDate: cells[6]?.trim() || "",
              winnerCageCode: cageCode,
              winnerName: "",
              quantity: qty,
              unitPrice,
              totalValue: unitPrice * qty,
            });
          }
        } catch {
          // Skip unparseable rows
        }
      }
    } else {
      errors.push("Could not find search form on DIBBS");
    }
  } finally {
    await context.close();
  }

  return {
    success: errors.length === 0,
    data: awards,
    errors,
    scrapedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
}

/**
 * Attempt to download the batch quote file from DIBBS Welcome page
 */
export async function downloadBatchFile(
  creds: DibbsCredentials
): Promise<{ success: boolean; csvContent: string | null; error: string | null }> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    const loggedIn = await loginToDibbs(page, creds);
    if (!loggedIn) {
      return { success: false, csvContent: null, error: "Failed to log into DIBBS" };
    }

    // Look for batch download link on Welcome page
    const batchLink = page.locator(
      'a:has-text("Batch"), a:has-text("Download"), a:has-text("batch"), a[href*="batch"], a[href*="Batch"], a[href*="download"]'
    ).first();

    if (await batchLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await batchLink.click();
      const download = await downloadPromise;

      // Read the downloaded file
      const filePath = await download.path();
      if (filePath) {
        const fs = await import("fs");
        const content = fs.readFileSync(filePath, "utf-8");
        return { success: true, csvContent: content, error: null };
      }
    }

    // If no download link, try to scrape the solicitation list directly
    return {
      success: false,
      csvContent: null,
      error: "Could not find batch download link on DIBBS Welcome page. Try manual download.",
    };
  } catch (err) {
    return { success: false, csvContent: null, error: `Download failed: ${err}` };
  } finally {
    await context.close();
  }
}

/**
 * Clean up browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
