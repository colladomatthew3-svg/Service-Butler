"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
(0, test_1.test)("marketing homepage and login form render", async ({ page }) => {
    await page.goto("/");
    await (0, test_1.expect)(page.getByRole("heading", { level: 1 })).toContainText(/find the jobs before competitors do and turn them into booked work/i);
    await page.goto("/login");
    await (0, test_1.expect)(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await (0, test_1.expect)(page.locator("input[type='email']").first()).toBeVisible();
    await (0, test_1.expect)(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
    await (0, test_1.expect)(page.getByRole("button", { name: /demo login/i })).toBeVisible();
});
