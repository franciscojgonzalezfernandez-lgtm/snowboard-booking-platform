import { test, expect, type Page } from "@playwright/test";

import en from "../messages/en.json";
import de from "../messages/de.json";
import es from "../messages/es.json";

// Read the expected copy from the translations rather than restating it here.
// Hard-coded strings rotted silently once already: these assertions still
// expected "Learn to ride" long after F-092 rewrote the headline, so the whole
// file had been failing unnoticed.
const MESSAGES = { en, de, es } as const;

const HOME_HEADLINE = {
  en: MESSAGES.en.home.hero_title_1,
  de: MESSAGES.de.home.hero_title_1,
  es: MESSAGES.es.home.hero_title_1,
} as const;

const CTA_PRIMARY = {
  en: MESSAGES.en.home.cta_primary,
  de: MESSAGES.de.home.cta_primary,
  es: MESSAGES.es.home.cta_primary,
} as const;

const CTA_SIGNIN = {
  en: MESSAGES.en.nav.signin,
  de: MESSAGES.de.nav.signin,
  es: MESSAGES.es.nav.signin,
} as const;

type Locale = keyof typeof HOME_HEADLINE;

async function expectLocaleHome(page: Page, locale: Locale) {
  await expect(page.locator("h1").first()).toContainText(
    HOME_HEADLINE[locale],
  );

  const primaryHref = await page
    .getByRole("link", { name: CTA_PRIMARY[locale], exact: true })
    .first()
    .getAttribute("href");
  expect(primaryHref).toBe(`/${locale}/reservar`);

  const signinHref = await page
    .getByRole("link", { name: CTA_SIGNIN[locale], exact: true })
    .first()
    .getAttribute("href");
  expect(signinHref).toBe(`/${locale}/login`);
}

test.describe("F-032 — Home page × 3 locales", () => {
  test("`/` redirects to default locale `/en`", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/en\/?$/);
    await expect(page.locator("h1").first()).toContainText(HOME_HEADLINE.en);
  });

  for (const locale of ["en", "de", "es"] as const) {
    test(`/${locale} renders translated headline and locale-scoped CTAs`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expectLocaleHome(page, locale);
    });
  }

  test("language switcher rotates EN → DE → ES → EN and preserves the home path", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.locator("h1").first()).toContainText(HOME_HEADLINE.en);

    await page.getByTestId("lang-de").first().click();
    await page.waitForURL(/\/de\/?$/);
    await expect(page.locator("h1").first()).toContainText(HOME_HEADLINE.de);

    await page.getByTestId("lang-es").first().click();
    await page.waitForURL(/\/es\/?$/);
    await expect(page.locator("h1").first()).toContainText(HOME_HEADLINE.es);

    await page.getByTestId("lang-en").first().click();
    await page.waitForURL(/\/en\/?$/);
    await expect(page.locator("h1").first()).toContainText(HOME_HEADLINE.en);
  });
});
