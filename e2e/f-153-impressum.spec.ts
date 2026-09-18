import { test, expect, type Page } from "@playwright/test";

// F-153 — Legal notice / Impressum. TWINT's onboarding rules require the website
// to display, in a legal notice, the business name + legal form, the full
// address and a contact (a sole proprietorship must also name the owner). These
// tests guard that the page and the footer surface exactly those fields, in
// every locale, so the requirement can't silently regress.

const IMPRESSUM_HEADING = {
  en: "Legal Notice",
  de: "Impressum",
  es: "Aviso legal",
} as const;

const IMPRESSUM_LINK_LABEL = {
  en: "Legal notice",
  de: "Impressum",
  es: "Aviso legal",
} as const;

const OPERATED_BY_LABEL = {
  en: "Operated by",
  de: "Betrieben von",
  es: "Operado por",
} as const;

// Locale-invariant legal identity (mirrors lib/legal/entity.ts).
const LEGAL = {
  legalName: "Gonzalez Fernandez Snowball Effect",
  legalForm: "Einzelfirma",
  owner: "Francisco Javier González Fernández",
  street: "Josefstrasse 4",
  cityLine: "8610 Uster",
  email: "franciscojgonzalezfernandez@gmail.com",
  phone: "+41 76 638 18 70",
} as const;

type Locale = keyof typeof IMPRESSUM_HEADING;

const LOCALES: Locale[] = ["en", "de", "es"];

async function expectFooterImpressumLink(page: Page, locale: Locale) {
  const footer = page.getByTestId("site-footer");
  await expect(footer).toBeVisible();

  const link = footer.getByTestId("footer-impressum-link");
  await expect(link).toHaveText(IMPRESSUM_LINK_LABEL[locale]);
  await expect(link).toHaveAttribute("href", `/${locale}/impressum`);

  const operator = footer.getByTestId("footer-operator");
  await expect(operator).toContainText(OPERATED_BY_LABEL[locale]);
  await expect(operator).toContainText(LEGAL.legalName);
  await expect(operator).toContainText(LEGAL.legalForm);
}

test.describe("F-153 — Impressum page carries the TWINT-required identity", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/impressum returns 200 with the full legal identity`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/impressum`);
      expect(response?.status()).toBe(200);

      await expect(page.getByTestId("impressum-heading")).toHaveText(
        IMPRESSUM_HEADING[locale],
      );

      // Every mandatory field must be visible in the identity block.
      const identity = page.getByTestId("impressum-identity");
      await expect(identity).toBeVisible();
      await expect(identity).toContainText(LEGAL.legalName);
      await expect(identity).toContainText(LEGAL.legalForm);
      await expect(identity).toContainText(LEGAL.owner);
      await expect(identity).toContainText(LEGAL.street);
      await expect(identity).toContainText(LEGAL.cityLine);
      await expect(identity).toContainText(LEGAL.email);
      await expect(identity).toContainText(LEGAL.phone);

      // Contact links must be actionable.
      await expect(
        identity.getByRole("link", { name: LEGAL.email }),
      ).toHaveAttribute("href", `mailto:${LEGAL.email}`);
    });
  }
});

test.describe("F-153 — Footer exposes the Impressum in each locale", () => {
  for (const locale of LOCALES) {
    test(`footer on /${locale} links to /impressum and names the operator`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expectFooterImpressumLink(page, locale);
    });

    test(`footer on /${locale}/impressum still links to /impressum`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/impressum`);
      await expectFooterImpressumLink(page, locale);
    });
  }
});
