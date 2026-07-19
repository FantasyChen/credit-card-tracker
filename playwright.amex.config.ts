import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/amex-benefit-reader",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: "list",
  outputDir: "test-results/amex-benefit-reader",
  use: {
    browserName: "chromium",
    headless: true,
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
