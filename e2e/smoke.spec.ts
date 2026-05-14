import { test, expect } from "@playwright/test";

test("home renders with expected title", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Snowboard Booking Platform/);
});
