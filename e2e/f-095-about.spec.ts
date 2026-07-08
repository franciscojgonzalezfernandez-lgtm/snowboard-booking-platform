import { test, expect } from "@playwright/test";

const LOCALES = ["en", "de", "es"] as const;

const HEADING = {
  en: "Just me and a board",
  de: "Nur ich und ein Board",
  es: "Solo yo y una tabla",
} as const;

// F-102 — translated slugs for the About and Instructors marketing pages.
const ABOUT_SLUG = { en: "about", de: "ueber-uns", es: "sobre" } as const;
const INSTRUCTORS_SLUG = {
  en: "instructors",
  de: "instruktoren",
  es: "instructores",
} as const;

test.describe("F-095 — About / brand story page", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/${ABOUT_SLUG[locale]} renders the story, video and CTAs`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/${ABOUT_SLUG[locale]}`);

      await expect(page.getByTestId("about-page")).toBeVisible();
      await expect(page.locator("h1")).toContainText(HEADING[locale]);

      // Three narrative sections (who / philosophy / mountain) + the CTA each
      // carry an <h2>. F-108 removed the "Why the name" section (the drop-moment
      // paragraph moved into "Why Flumserberg"), dropping the count from 5 to 4.
      expect(await page.locator("h2").count()).toBeGreaterThanOrEqual(4);

      await expect(page.getByTestId("about-video")).toBeVisible();

      await expect(page.getByTestId("about-cta-book")).toHaveAttribute(
        "href",
        `/${locale}/reservar`,
      );
      await expect(page.getByTestId("about-cta-instructors")).toHaveAttribute(
        "href",
        `/${locale}/${INSTRUCTORS_SLUG[locale]}`,
      );
    });
  }

  test("nav About link points to the about page", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("navigation").getByRole("link", { name: /about/i }).first().click();
    await page.waitForURL(`**/${ABOUT_SLUG.en}`);
    await expect(page.getByTestId("about-page")).toBeVisible();
  });
});
