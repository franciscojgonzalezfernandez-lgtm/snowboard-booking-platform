import { test, expect } from "@playwright/test";

const LOCALES = ["en", "de", "es"] as const;

const HEADING = {
  en: "The Drop is just me and a board",
  de: "The Drop, das sind nur ich und ein Board",
  es: "The Drop somos yo y una tabla",
} as const;

test.describe("F-095 — About / brand story page", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/sobre renders the story, video and CTAs`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/sobre`);

      await expect(page.getByTestId("about-page")).toBeVisible();
      await expect(page.locator("h1")).toContainText(HEADING[locale]);

      // The four narrative sections + the CTA each carry an <h2>.
      expect(await page.locator("h2").count()).toBeGreaterThanOrEqual(5);

      await expect(page.getByTestId("about-video")).toBeVisible();

      await expect(page.getByTestId("about-cta-book")).toHaveAttribute(
        "href",
        `/${locale}/reservar`,
      );
      await expect(page.getByTestId("about-cta-instructors")).toHaveAttribute(
        "href",
        `/${locale}/instructores`,
      );
    });
  }

  test("nav About link points to the about page", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("navigation").getByRole("link", { name: /about/i }).first().click();
    await page.waitForURL("**/sobre");
    await expect(page.getByTestId("about-page")).toBeVisible();
  });
});
