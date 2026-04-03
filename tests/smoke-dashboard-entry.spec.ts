import { expect, test } from "@playwright/test";

test("dashboard entry point renders in demo mode", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /operator command center/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /opportunities to work first/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /verified leads to contact next/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /real capture vs qualified lead proof/i })).toBeVisible();
  await expect(page.getByText(/signals and opportunities show market pressure/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open opportunities/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open leads/i })).toBeVisible();
});
