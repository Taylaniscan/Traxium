import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile?.(".env");

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3100";
const serverPort = new URL(baseURL).port || "3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "outputs/playwright-artifacts",
  reporter: [
    ["list"],
    ["html", { outputFolder: "outputs/playwright-report", open: "never" }],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `PORT=${serverPort} NEXT_DIST_DIR=.next-e2e npm run start`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
