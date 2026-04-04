import { expect, test } from "@playwright/test";

test("demo smoke: lead inbox to job conversion and schedule board", async ({ page }) => {
  await page.goto("/dashboard/leads");

  await expect(page.getByRole("heading", { name: "Lead Inbox" })).toBeVisible({ timeout: 45000 });
  await page.waitForResponse((response) => response.request().method() === "GET" && response.url().includes("/api/leads") && response.ok());

  const leadLink = page.getByRole("link", { name: "Sarah Parker" }).first();
  await expect(leadLink).toBeVisible({ timeout: 15000 });
  await leadLink.click();

  await expect(page).toHaveURL(/\/dashboard\/leads\/lead-demo-1$/);
  await expect(page.getByRole("button", { name: /Convert to Job|Open Job/i }).first()).toBeVisible();

  await page.getByRole("button", { name: /Convert to Job|Open Job/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/jobs\/job-demo-1$/);

  await page.goto("/dashboard/schedule");
  await expect(page).toHaveURL(/\/dashboard\/schedule/);
  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming Scheduled Leads" })).toBeVisible();
});
