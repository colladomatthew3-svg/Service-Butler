import { expect, test } from "@playwright/test";

test("pipeline page renders in demo mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/pipeline");

  await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Keep work moving from booked to complete without hunting through cards\./i })).toBeVisible();
  await expect(page.getByText("Command view", { exact: true })).toBeVisible();
});
