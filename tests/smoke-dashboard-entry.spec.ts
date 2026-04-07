import { expect, test } from "@playwright/test";

test("dashboard entry point fails closed instead of showing synthetic operator data in demo mode", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /lead-to-job command board/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /today's opportunities/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /leads ready to contact/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /booked-job proof/i })).toBeVisible();
  await expect(page.getByText(/no real opportunities detected yet/i)).toBeVisible();
  await expect(page.getByText(/no verified lead queue yet/i)).toBeVisible();
  await expect(page.getByText(/blocked live sources/i)).toBeVisible();
  await expect(page.getByText(/simulated sources/i)).toBeVisible();
  await expect(page.getByText(/no buyer-safe proof chain yet/i)).toBeVisible();
  await expect(page.getByText(/research queue waiting on verified contact/i)).toBeVisible();
  await expect(page.getByText(/signal -> sdr -> lead -> job/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open opportunities/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open leads/i })).toBeVisible();
});
