import { expect, test } from "@playwright/test";

test("weather service area persists in demo mode", async ({ page }) => {
  await page.goto("/dashboard/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByTestId("weather-city").fill("Tampa");
  await page.getByTestId("weather-state").fill("FL");
  await page.getByTestId("weather-postal").fill("33602");
  await page.getByTestId("weather-lat").fill("");
  await page.getByTestId("weather-lng").fill("");
  await page.getByTestId("weather-save").click();

  await expect(page.getByTestId("weather-current-location")).toContainText("Tampa, FL 33602");
  await page.reload();
  await expect(page.getByTestId("weather-current-location")).toContainText("Tampa, FL 33602");
  await expect(page.getByRole("heading", { name: "Weather Watch" })).toBeVisible();
});
