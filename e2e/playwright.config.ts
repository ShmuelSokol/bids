import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: process.env.STAGING_URL || "https://dibs-gov-staging-staging.up.railway.app",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 900 } } }],
  reporter: [["html", { open: "never" }], ["list"]],
});
