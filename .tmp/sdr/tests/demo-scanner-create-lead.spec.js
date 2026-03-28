"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
(0, test_1.test)("scanner opportunity can create a lead and open lead detail in demo mode", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Demo Login" }).click();
    await page.goto("/dashboard/scanner");
    await (0, test_1.expect)(page.getByRole("heading", { name: "Opportunity Scanner" })).toBeVisible();
    await page.getByTestId("scanner-run").click();
    const firstCard = page.getByTestId("scanner-result-card").first();
    await (0, test_1.expect)(firstCard).toBeVisible({ timeout: 15000 });
    const firstCardText = await firstCard.textContent();
    await firstCard.getByRole("button", { name: "Create Lead" }).click();
    await (0, test_1.expect)(page).toHaveURL(/\/dashboard\/leads\/.+/);
    await (0, test_1.expect)(page.getByRole("button", { name: "Call" })).toBeVisible();
    await (0, test_1.expect)(page.getByText(/Scanner demo: Why this opportunity:/)).toBeVisible();
    const matchedAddress = firstCardText?.match(/\d+\s+[A-Za-z0-9 ]+,\s*[A-Za-z ]+,\s*[A-Z]{2}\s+\d{5}/)?.[0];
    if (matchedAddress) {
        await (0, test_1.expect)(page.getByText(matchedAddress, { exact: true }).first()).toBeVisible();
    }
});
