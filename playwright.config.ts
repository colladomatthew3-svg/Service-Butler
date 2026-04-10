import { defineConfig, devices } from "@playwright/test";

const startServer = process.env.PLAYWRIGHT_START_SERVER === "true";
const defaultPort = startServer ? "3004" : "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${defaultPort}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry"
  },
  webServer: startServer
    ? {
        command:
          `PORT=${defaultPort} DEMO_MODE=true ALLOW_NON_DEV_DEMO_MODE=true npm run dev`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120000
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
