import { defineConfig } from "@playwright/test";
import { e2eBaseUrl } from "./e2e/fixture-values";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "line",
  use: {
    baseURL: e2eBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "tsx scripts/e2e-server.mts",
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
