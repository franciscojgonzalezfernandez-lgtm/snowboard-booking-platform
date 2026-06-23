import { test, expect } from "@playwright/test";

const LOCALES = ["en", "de", "es"] as const;

const INDEX_HEADING = {
  en: "Notes from the hill",
  de: "Notizen vom Berg",
  es: "Notas de la montaña",
} as const;

// First-day post, one localized slug + title per locale (shared id "first-day").
const FIRST_DAY = {
  en: {
    slug: "your-first-day-on-a-snowboard",
    title: "Your first day on a snowboard",
  },
  de: {
    slug: "dein-erster-tag-auf-dem-snowboard",
    title: "Dein erster Tag auf dem Snowboard",
  },
  es: {
    slug: "tu-primer-dia-en-snowboard",
    title: "Tu primer día en snowboard",
  },
} as const;

test.describe("F-098 — Blog (Field notes)", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/blog lists posts`, async ({ page }) => {
      await page.goto(`/${locale}/blog`);

      await expect(page.locator("h1")).toContainText(INDEX_HEADING[locale]);

      const cards = page.getByTestId("blog-card");
      expect(await cards.count()).toBeGreaterThan(0);

      // First-day post is linked from the index in this locale's slug.
      const card = page.locator(
        `[data-testid="blog-card"][href$="/blog/${FIRST_DAY[locale].slug}"]`,
      );
      await expect(card).toBeVisible();
    });

    test(`/${locale} post resolves by localized slug`, async ({ page }) => {
      await page.goto(`/${locale}/blog/${FIRST_DAY[locale].slug}`);

      await expect(page.getByTestId("blog-post")).toBeVisible();
      await expect(page.locator("h1")).toContainText(FIRST_DAY[locale].title);

      // CTA drops into the booking funnel.
      const cta = page.getByTestId("blog-cta");
      await expect(cta).toHaveAttribute("href", `/${locale}/reservar`);
    });
  }

  test("post exposes hreflang alternates for all locales", async ({ page }) => {
    await page.goto(`/en/blog/${FIRST_DAY.en.slug}`);

    for (const locale of LOCALES) {
      const alt = page.locator(
        `link[rel="alternate"][hreflang="${locale}"]`,
      );
      await expect(alt).toHaveAttribute(
        "href",
        new RegExp(`/${locale}/blog/${FIRST_DAY[locale].slug}$`),
      );
    }

    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveAttribute("href", new RegExp(`/en/blog/${FIRST_DAY.en.slug}$`));
  });

  test("card navigates to the post", async ({ page }) => {
    await page.goto("/en/blog");
    await page
      .locator(
        `[data-testid="blog-card"][href$="/blog/${FIRST_DAY.en.slug}"]`,
      )
      .click();
    await page.waitForURL(`**/blog/${FIRST_DAY.en.slug}`);
    await expect(page.getByTestId("blog-post")).toBeVisible();
  });

  test("unknown slug returns 404", async ({ page }) => {
    const res = await page.goto("/en/blog/no-such-post");
    expect(res?.status()).toBe(404);
  });
});
