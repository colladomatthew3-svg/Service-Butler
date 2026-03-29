import { expect, test } from "@playwright/test";

test("settings exposes the control-plane surface", async ({ page }) => {
  await page.goto("/dashboard/settings");

  await expect(page.getByRole("heading", { name: /restoration intelligence control plane/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /live-safe operating dependencies/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /weather and routing context/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /live-safe operating dependencies/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /run now/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /open network overview/i }).first()).toBeVisible();
});

test("network overview renders the buyer proof surface", async ({ page }) => {
  await page.goto("/dashboard/network");

  await expect(page.getByRole("heading", { name: /network overview/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /lead quality by source/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /active source status/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /contactable lead evidence/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /why this can sell to a buyer/i })).toBeVisible();
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
