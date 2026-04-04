import { expect, test } from "@playwright/test";

test("marketing homepage and login form render", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /find the jobs before competitors do and turn them into booked work/i
    ,
    { timeout: 45000 }
  );

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible({ timeout: 45000 });
  await expect(page.locator("input[type='email']").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /demo login/i })).toBeVisible();
});
