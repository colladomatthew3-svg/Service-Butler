import { expect, test } from "@playwright/test";

test("opportunities page renders the source-driven work queue", async ({ page }) => {
  await page.goto("/dashboard/opportunities");

  await expect(page.getByRole("heading", { name: /^opportunities$/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /opportunities ranked for action/i })).toBeVisible();
  await expect(page.getByText(/can become real jobs after verification/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open sdr lane/i })).toBeVisible();
  await expect(page.getByText(/needs sdr/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /all signals/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open scanner/i }).first()).toBeVisible();

  const researchOnlyRow = page.locator("tr").filter({ hasText: /research only|queued for sdr/i }).first();
  if (await researchOnlyRow.count()) {
    await expect(researchOnlyRow.getByRole("link", { name: /send to sdr|review in sdr lane/i })).toBeVisible();
    await expect(researchOnlyRow.getByRole("link", { name: /launch buyer flow/i })).toHaveCount(0);
    await expect(page.getByText(/research-only until sdr verifies a real contact path|finish contact verification before this turns into a lead or job/i)).toBeVisible();
  }
});
