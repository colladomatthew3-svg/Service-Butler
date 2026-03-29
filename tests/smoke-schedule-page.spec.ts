import { expect, test } from "@playwright/test";

test("schedule page renders in demo mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/schedule");

  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /A cleaner view of what is on the board today\./i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming Scheduled Leads" })).toBeVisible();
});
