import { test, expect, type Page } from "@playwright/test";

const TERMS_HEADING = {
  en: "Terms and Conditions",
  de: "Allgemeine Geschäftsbedingungen",
  es: "Términos y Condiciones",
} as const;

const PRIVACY_HEADING = {
  en: "Privacy Policy",
  de: "Datenschutzerklärung",
  es: "Política de Privacidad",
} as const;

const TERMS_LINK_LABEL = {
  en: "Terms",
  de: "AGB",
  es: "Términos",
} as const;

const PRIVACY_LINK_LABEL = {
  en: "Privacy",
  de: "Datenschutz",
  es: "Privacidad",
} as const;

type Locale = keyof typeof TERMS_HEADING;

const LOCALES: Locale[] = ["en", "de", "es"];

async function expectFooterLegalLinks(page: Page, locale: Locale) {
  const footer = page.getByTestId("site-footer");
  await expect(footer).toBeVisible();

  const termsLink = footer.getByTestId("footer-terms-link");
  await expect(termsLink).toHaveText(TERMS_LINK_LABEL[locale]);
  await expect(termsLink).toHaveAttribute("href", `/${locale}/terms`);

  const privacyLink = footer.getByTestId("footer-privacy-link");
  await expect(privacyLink).toHaveText(PRIVACY_LINK_LABEL[locale]);
  await expect(privacyLink).toHaveAttribute("href", `/${locale}/privacy`);
}

test.describe("F-040 — Terms page renders in each locale", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/terms returns 200 and shows the localised heading`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/terms`);
      expect(response?.status()).toBe(200);

      await expect(page.getByTestId("terms-heading")).toHaveText(
        TERMS_HEADING[locale],
      );

      const sections = [
        "terms-section-prices",
        "terms-section-lessons",
        "terms-section-insurance",
        "terms-section-registration",
        "terms-section-cancellation-customer",
        "terms-section-cancellation-school",
        "terms-section-ski-tickets",
        "terms-section-jurisdiction",
      ];
      for (const id of sections) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
    });
  }
});

test.describe("F-040 — Privacy page renders in each locale", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/privacy returns 200 and shows the localised heading`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/privacy`);
      expect(response?.status()).toBe(200);

      await expect(page.getByTestId("privacy-heading")).toHaveText(
        PRIVACY_HEADING[locale],
      );

      const sections = [
        "privacy-section-controller",
        "privacy-section-data",
        "privacy-section-processors",
        "privacy-section-retention",
        "privacy-section-rights",
        "privacy-section-contact",
      ];
      for (const id of sections) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
    });
  }
});

test.describe("F-040 — Global footer carries the legal links in each locale", () => {
  for (const locale of LOCALES) {
    test(`footer on /${locale} exposes /terms + /privacy with localised labels`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expectFooterLegalLinks(page, locale);
    });

    test(`footer on /${locale}/terms still exposes both legal links`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/terms`);
      await expectFooterLegalLinks(page, locale);
    });

    test(`footer on /${locale}/privacy still exposes both legal links`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/privacy`);
      await expectFooterLegalLinks(page, locale);
    });
  }
});
