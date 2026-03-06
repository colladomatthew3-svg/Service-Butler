import { expect, test } from "@playwright/test";

test("scanner demo flow shows deterministic opportunities", async ({ page }) => {
  await page.goto("/dashboard/scanner");

  await expect(page.getByRole("heading", { name: "Opportunity Scanner" })).toBeVisible();

  await page.getByTestId("scanner-location").fill("11717");
  await page.getByRole("button", { name: "Plumbing" }).click();
  await page.getByTestId("scanner-trigger-freeze").click();
  await page.getByTestId("scanner-radius").selectOption("50");
  await page.getByTestId("scanner-run").click();

  const cards = page.getByTestId("scanner-result-card");
  await expect(cards.first()).toBeVisible();
  await expect(cards.first()).toContainText("Incident type");
  await expect(cards.first()).toContainText("Urgency window");
  await expect(cards.first()).toContainText("Next action");
  await expect(cards.first()).toContainText("Demand signal explanation");
  await expect(cards.first()).toContainText(/service match|abatement|inspection|mitigation/i);
});
