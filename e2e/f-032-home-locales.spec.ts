import { test, expect, type Page } from "@playwright/test";

const HOME_HEADLINE = {
  en: "Learn to ride",
  de: "Snowboarden im",
  es: "Aprende a montar",
} as const;

const CTA_PRIMARY = {
  en: "Book a lesson",
  de: "Stunde buchen",
  es: "Reservar clase",
} as const;

const CTA_SIGNIN = {
  en: "Sign in",
  de: "Anmelden",
  es: "Iniciar sesión",
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
