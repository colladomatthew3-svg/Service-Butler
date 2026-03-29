import { expect, test } from "@playwright/test";

test("outbound page renders in demo mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/outbound");

  await expect(page.getByRole("heading", { name: "Outbound Engine" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Opportunities To Work" })).toBeVisible();
  await expect(page.getByText("Outbound Workspace", { exact: true })).toBeVisible();
});
