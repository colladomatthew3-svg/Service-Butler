import { expect, test } from "@playwright/test";
import { currentValueOrHourly } from "../src/lib/services/weather";

test("weather service falls back to hourly values when current block is incomplete", async () => {
  expect(currentValueOrHourly(undefined, [72, 74, 76], 1)).toBe(74);
  expect(currentValueOrHourly(68, [72, 74, 76], 1)).toBe(68);
  expect(currentValueOrHourly(undefined, undefined, 1)).toBeUndefined();
});
