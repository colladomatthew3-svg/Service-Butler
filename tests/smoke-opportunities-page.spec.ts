import { expect, test } from "@playwright/test";

test("opportunities page renders the source-driven work queue", async ({ page }) => {
  await page.goto("/dashboard/opportunities");

  await expect(page.getByRole("heading", { name: /opportunities/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /opportunities ranked for action/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /all signals/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open scanner/i }).first()).toBeVisible();
});
