import { expect, test } from "@playwright/test";

test("dashboard entry point fails closed instead of showing synthetic operator data in demo mode", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /operator command center/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /opportunities to work first/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /verified leads to contact next/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /real capture vs qualified lead proof/i })).toBeVisible();
  await expect(page.getByText(/no real opportunities detected yet/i)).toBeVisible();
  await expect(page.getByText(/no verified lead queue yet/i)).toBeVisible();
  await expect(page.getByText(/live source setup required/i)).toBeVisible();
  await expect(page.getByText(/open data sources, activate real connectors, then run the scanner/i)).toBeVisible();
  await expect(page.getByText(/no buyer-safe proof chain yet/i)).toBeVisible();
  await expect(page.getByText(/route research-only rows into sdr/i)).toBeVisible();
  await expect(page.getByText(/no booked visits yet/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open opportunities/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open leads/i })).toBeVisible();
});
