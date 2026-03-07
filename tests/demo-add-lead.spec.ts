import { expect, test } from "@playwright/test";

test("manual add lead works in demo mode", async ({ page }) => {
  await page.goto("/dashboard/leads");

  await expect(page.getByRole("heading", { name: "Lead Inbox" })).toBeVisible();
  await page.getByRole("button", { name: "Add Lead" }).first().click();

  await page.getByLabel("Customer name").fill("Mason Carter");
  await page.getByLabel("Phone").fill("+1 631 555 0148");
  await page.getByLabel("Address (optional)").fill("214 Bayview Avenue");
  await page.getByLabel("City").fill("Patchogue");
  await page.getByLabel("State").fill("NY");
  await page.getByLabel("Postal").fill("11772");
  await page.getByLabel("Notes").fill("Basement moisture inspection requested for tomorrow morning.");
  await page.getByRole("button", { name: /^Add Lead$/ }).last().click();

  await expect(page).toHaveURL(/\/dashboard\/leads\/.+/);
  await expect(page.getByText("Mason Carter")).toBeVisible();
  await expect(page.getByText("214 Bayview Avenue, Patchogue, NY, 11772")).toBeVisible();
});
