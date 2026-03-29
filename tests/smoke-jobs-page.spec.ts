import { expect, test } from "@playwright/test";

test("jobs page renders in demo mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/jobs");

  await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jobs Board" })).toBeVisible();
  await expect(page.getByText("Job Control")).toBeVisible();
});
