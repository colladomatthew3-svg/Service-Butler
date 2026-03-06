import { expect, test } from "@playwright/test";

test("dashboard entry point renders in demo mode", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /dispatch dashboard/i })).toBeVisible();
  await expect(page.getByText(/demo mode \(no auth\)/i)).toBeVisible();
});
