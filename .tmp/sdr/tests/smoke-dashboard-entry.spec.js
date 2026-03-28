"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
(0, test_1.test)("dashboard entry point renders in demo mode", async ({ page }) => {
    await page.goto("/dashboard");
    await (0, test_1.expect)(page).toHaveURL(/\/dashboard/);
    await (0, test_1.expect)(page.getByRole("heading", { name: /dispatch dashboard/i })).toBeVisible();
    await (0, test_1.expect)(page.getByText(/demo mode \(no auth\)/i)).toBeVisible();
});
