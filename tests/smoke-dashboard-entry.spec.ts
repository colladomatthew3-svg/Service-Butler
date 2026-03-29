import { expect, test } from "@playwright/test";

test("dashboard entry point renders in demo mode", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /operator command center/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /signals to work first/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /verified leads to contact next/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /view scanner/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open leads/i })).toBeVisible();
});
