import { expect, test } from "@playwright/test";
import { buildIntegrationReadinessSummary } from "../src/lib/control-plane/integration-readiness";
import { getProductionReadinessSummary } from "../src/lib/v2/readiness";

async function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("dashboard exposes inline source readiness", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: /operator command center/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /live ingestion snapshot/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open data sources/i })).toBeVisible();
  await expect(page.getByText(/open data sources/i)).toBeVisible();
});

test("network readiness fails closed when tenant context is unavailable", async () => {
  await withEnv(
    {
      NEXT_PUBLIC_APP_URL: "https://service-butler.test",
      SB_USE_V2_READS: "false",
      SB_USE_V2_WRITES: "false",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      WEBHOOK_SHARED_SECRET: undefined
    },
    async () => {
      const summary = await getProductionReadinessSummary({ supabase: null });

      expect(summary.status).toBe("fail");
      expect(summary.tenant).toBeNull();
      expect(summary.checks.some((check) => check.key === "supabase_client" && check.status === "warn")).toBeTruthy();
      expect(summary.checks.some((check) => check.key === "v2_flags" && check.status === "fail")).toBeTruthy();
    }
  );
});

test("integration readiness exposes inline tenant-not-live warnings", async () => {
  const summary = await buildIntegrationReadinessSummary();

  const warnKeys = summary.checks
    .filter((check) => check.status === "warn")
    .map((check) => check.name)
    .filter(Boolean);

  expect(warnKeys).toContain("territories");
  expect(warnKeys).toContain("data_sources");
  expect(warnKeys).toContain("service_area");
});

test("network overview renders the buyer proof surface", async ({ page }) => {
  await page.goto("/dashboard/network");

  await expect(page.getByRole("heading", { name: /network overview/i })).toBeVisible();
  const blockedHeading = page.getByRole("heading", { name: /this environment is not live enough to show buyer-proof metrics/i });
  if (await blockedHeading.isVisible().catch(() => false)) {
    await expect(page.getByText(/buyer proof blocked/i)).toBeVisible();
    await expect(page.getByText(/remediation/i)).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: /lead quality by source/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /active source status/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /contactable lead evidence/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /why this can sell to a buyer/i })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /review data sources/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open operator view/i })).toBeVisible();
});

test("dashboard read-model endpoints expose the buyer network surface", async ({ request }) => {
  const franchiseResponse = await request.get("/api/dashboard/franchise");
  expect(franchiseResponse.ok()).toBeTruthy();

  const franchise = (await franchiseResponse.json()) as Record<string, unknown>;
  expect(franchise).toHaveProperty("metrics");
  expect(Array.isArray(franchise.metrics)).toBeTruthy();
  expect(franchise).toHaveProperty("lead_quality_proof");

  const corporateResponse = await request.get("/api/dashboard/corporate");
  expect(corporateResponse.ok()).toBeTruthy();

  const corporate = (await corporateResponse.json()) as Record<string, unknown>;
  expect(corporate).toHaveProperty("metrics");
  expect(Array.isArray(corporate.metrics)).toBeTruthy();
  expect(corporate).toHaveProperty("byFranchise");
});
