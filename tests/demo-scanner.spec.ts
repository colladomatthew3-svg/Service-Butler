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
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  await expect(cards.first()).toContainText("Intent score");
  await expect(cards.first()).toContainText("Confidence score");
  await expect(cards.first()).toContainText("Why this opportunity exists");
  await expect(cards.first()).toContainText("Suggested next action");
  await expect(cards.first()).toContainText(/storm restoration|abatement|inspection|mitigation|demolition/i);
});
