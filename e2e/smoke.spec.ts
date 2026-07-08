import { test, expect } from "@playwright/test";

test("home renders with expected title", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  // F-103 gave the home its own keyword-tuned title (was the generic root fallback).
  await expect(page).toHaveTitle(/Private snowboard lessons in Flumserberg/);
});
