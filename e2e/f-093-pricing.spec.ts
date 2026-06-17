import { test, expect } from "@playwright/test";

const LOCALES = ["en", "de", "es"] as const;

// Card order mirrors the duration ladder rendered on /precios.
const DURATIONS = ["ONE_HOUR", "TWO_HOURS", "INTENSIVE", "FULL_DAY"] as const;

test.describe("F-093 — Pricing page renders four tiers in each locale", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/precios shows 4 cards with DB prices`, async ({ page }) => {
      const response = await page.goto(`/${locale}/precios`);
      expect(response?.status()).toBe(200);

      await expect(page.getByTestId("pricing-page")).toBeVisible();

      for (const duration of DURATIONS) {
        await expect(page.getByTestId(`pricing-card-${duration}`)).toBeVisible();
        // Price is read from Season.priceCentsByDuration and formatted de-CH
        // (CHF). It is never hardcoded in i18n, so a CHF amount on screen
        // proves the DB read + formatter ran.
        await expect(page.getByTestId(`pricing-price-${duration}`)).toContainText(
          /CHF\s?[\d'.,]+/,
        );
      }

      // The "honest about the deal" strip (lift pass / gear / age / languages).
      await expect(page.getByTestId("pricing-included")).toBeVisible();
    });
  }
});

test.describe("F-093 — Take-home video perk is conditional (2h only)", () => {
  test("perk shows on the 2-hour card and nowhere else", async ({ page }) => {
    await page.goto("/en/precios");
    await expect(page.getByTestId("pricing-perk-TWO_HOURS")).toBeVisible();
    for (const duration of ["ONE_HOUR", "INTENSIVE", "FULL_DAY"] as const) {
      await expect(page.getByTestId(`pricing-perk-${duration}`)).toHaveCount(0);
    }
  });
});

test.describe("F-093 — CTA preselects the duration in the booking funnel", () => {
  for (const locale of LOCALES) {
    test(`/${locale} cards link to /reservar with the duration query`, async ({ page }) => {
      await page.goto(`/${locale}/precios`);

      // Every CTA carries the funnel's `d` query key (use-booking-url-state).
      for (const duration of DURATIONS) {
        await expect(page.getByTestId(`pricing-cta-${duration}`)).toHaveAttribute(
          "href",
          `/${locale}/reservar?d=${duration}`,
        );
      }

      // Clicking lands on the funnel with the duration preselected.
      await page.getByTestId("pricing-cta-INTENSIVE").click();
      await page.waitForURL(`/${locale}/reservar?d=INTENSIVE`);
      await expect(page.getByTestId("select-duration")).toBeVisible();
    });
  }
});
