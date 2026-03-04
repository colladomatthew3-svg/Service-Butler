import { expect, test } from "@playwright/test";

test("marketing homepage and login form render", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: /servicebutler/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/never lose another lead/i);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
});
