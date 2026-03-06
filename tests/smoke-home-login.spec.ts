import { expect, test } from "@playwright/test";

test("marketing homepage and login form render", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByAltText(/service butler logo/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/win more leads and run a tighter service business/i);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.locator("input[type='email']").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /demo login/i })).toBeVisible();
});
