import { test, expect } from "@playwright/test";

import en from "../messages/en.json";
import de from "../messages/de.json";
import es from "../messages/es.json";

/**
 * F-132 — the four lessons render as commercial product cards, and on mobile
 * they are a snap rail rather than a four-screen column.
 *
 * Expectations are derived from `messages/*.json` rather than repeated here —
 * the lesson of F-126, where hard-coded copy rotted the home specs in silence.
 */
const MESSAGES = { en, de, es } as const;
const LOCALES = ["en", "de", "es"] as const;
const DURATIONS = ["ONE_HOUR", "TWO_HOURS", "INTENSIVE", "FULL_DAY"] as const;
const TIER_KEY = {
  ONE_HOUR: "oneHour",
  TWO_HOURS: "twoHours",
  INTENSIVE: "intensive",
  FULL_DAY: "fullDay",
} as const;

const PRICING_SLUG = { en: "pricing", de: "preise", es: "precios" } as const;

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

test.describe("F-132 — commercial product cards", () => {
  for (const locale of LOCALES) {
    test(`/${locale} home shows the four products with photo + commercial name`, async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(`/${locale}`);

      const m = MESSAGES[locale];
      await expect(
        page.getByRole("heading", { name: m.home.classes_title }),
      ).toBeVisible();

      for (const duration of DURATIONS) {
        const card = page.getByTestId(`home-tier-${duration}`);
        const tier = m.pricing.tier[TIER_KEY[duration]];

        await expect(card).toBeVisible();
        await expect(card).toContainText(tier.product);
        await expect(card).toContainText(tier.length);
        // The photo is what makes it a product card rather than a text tile.
        await expect(card.locator("img")).toHaveAttribute("src", /\/_next\/image/);
        await expect(card).toHaveAttribute(
          "href",
          `/${locale}/reservar?d=${duration}`,
        );
      }
    });
  }

  test("exactly one tier is flagged as recommended, on both surfaces", async ({
    page,
  }) => {
    const flag = MESSAGES.en.pricing.tier.intensive.flag;

    await page.setViewportSize(DESKTOP);
    await page.goto("/en");
    await expect(page.getByText(flag, { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("home-tier-INTENSIVE")).toContainText(flag);

    await page.goto(`/en/${PRICING_SLUG.en}`);
    await expect(page.getByText(flag, { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("pricing-card-INTENSIVE")).toContainText(flag);
  });

  test("pricing cards keep the keyword-led name next to the commercial one", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/en/${PRICING_SLUG.en}`);

    for (const duration of DURATIONS) {
      const tier = MESSAGES.en.pricing.tier[TIER_KEY[duration]];
      const card = page.getByTestId(`pricing-card-${duration}`);
      await expect(card).toContainText(tier.product);
      // Dropping this would quietly degrade the Course JSON-LD, which is built
      // from the same string.
      await expect(card).toContainText(tier.name);
    }
  });
});

test.describe("F-132 — mobile rails", () => {
  const RAILS = [
    { path: "/en", label: "home (classes + reviews)", expected: 2 },
    { path: `/en/${PRICING_SLUG.en}`, label: "pricing", expected: 1 },
  ];

  for (const { path, label, expected } of RAILS) {
    test(`${label} scrolls horizontally on mobile and not on desktop`, async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto(path);

      const rails = page.getByTestId("card-scroller");
      await expect(rails).toHaveCount(expected);

      const overflows = await rails.evaluateAll((els) =>
        els.map((el) => el.scrollWidth > el.clientWidth + 1),
      );
      expect(overflows).toEqual(Array(expected).fill(true));

      // A snapped card must land on the page gutter, not under it.
      const snapType = await rails
        .first()
        .evaluate((el) => getComputedStyle(el).scrollSnapType);
      expect(snapType).toContain("x");

      await page.setViewportSize(DESKTOP);
      const stillOverflows = await rails.evaluateAll((els) =>
        els.map((el) => el.scrollWidth > el.clientWidth + 1),
      );
      expect(stillOverflows).toEqual(Array(expected).fill(false));
    });
  }
});

test.describe("F-132 — reviews are attributed to Google", () => {
  test("every review carries five stars and the Google source badge", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/en");

    const figures = page.locator("figure").filter({ hasText: "Krishna Vyas" });
    await expect(figures).toHaveCount(1);

    const badges = page.getByText(MESSAGES.en.home.reviews_source, {
      exact: true,
    });
    await expect(badges).toHaveCount(4);

    const ratings = page.getByRole("img", {
      name: MESSAGES.en.home.reviews_rating,
    });
    await expect(ratings).toHaveCount(4);
  });
});
