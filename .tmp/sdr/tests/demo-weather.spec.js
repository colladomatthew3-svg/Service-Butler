"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
(0, test_1.test)("weather service area persists in demo mode", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await (0, test_1.expect)(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.getByTestId("weather-city").fill("Tampa");
    await page.getByTestId("weather-state").fill("FL");
    await page.getByTestId("weather-postal").fill("33602");
    await page.getByText("Advanced map pin (optional)").click();
    await page.getByTestId("weather-lat").fill("");
    await page.getByTestId("weather-lng").fill("");
    await page.getByTestId("weather-save").click();
    await (0, test_1.expect)(page.getByTestId("weather-current-location")).toContainText("Tampa, FL 33602");
    await page.reload();
    await (0, test_1.expect)(page.getByTestId("weather-current-location")).toContainText("Tampa, FL 33602");
    await (0, test_1.expect)(page.getByRole("heading", { name: "Weather Watch" })).toBeVisible();
});
