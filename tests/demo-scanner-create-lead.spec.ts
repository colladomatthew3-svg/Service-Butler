import { expect, test } from "@playwright/test";

test("scanner opportunity can create a lead and open lead detail in demo mode", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Demo Login" }).click();

  await page.goto("/dashboard/scanner");
  await expect(page.getByRole("heading", { name: "Opportunity Scanner" })).toBeVisible();

  const firstCard = page.getByTestId("scanner-result-card").first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByRole("button", { name: "Create Lead" }).click();

  await expect(page).toHaveURL(/\/dashboard\/leads\/.+/);
  await expect(page.getByRole("button", { name: "Call" })).toBeVisible();
  await expect(page.getByText(/Scanner demo: Why this opportunity:/)).toBeVisible();
});
