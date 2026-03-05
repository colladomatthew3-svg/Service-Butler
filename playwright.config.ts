import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT || 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    env: {
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "demo-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "demo-service-role-key",
      DEV_AUTH_PASSWORD: process.env.DEV_AUTH_PASSWORD || "demo123",
      DEMO_MODE: process.env.DEMO_MODE || "on",
      REVIEW_MODE: process.env.REVIEW_MODE || "off",
      NEXT_TELEMETRY_DISABLED: "1"
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
