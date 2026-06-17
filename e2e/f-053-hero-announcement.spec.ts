import { test, expect } from "@playwright/test";

// Default copy ships `enabled: "true"` in messages/*.json, so the band renders
// without any translation override. The `enabled: "false"` branch is a one-line
// messages edit (owner toggles it off) and is covered by the server component's
// early return — not worth mocking next-intl server messages in an e2e here.

const BODY = {
  en: "Planning a team or group day on the mountain?",
  de: "Team- oder Gruppentag am Berg geplant?",
  es: "¿Un día de equipo o grupo en la montaña?",
} as const;

const CTA_LABEL = {
  en: "Get in touch",
  de: "Melde dich",
  es: "Escríbeme",
} as const;

const CLOSE_LABEL = {
  en: "Dismiss announcement",
  de: "Hinweis schließen",
  es: "Cerrar aviso",
} as const;

const CTA_HREF = "tel:+41766381870";

test.describe("F-053 — Hero announcement banner", () => {
  for (const locale of ["en", "de", "es"] as const) {
    test(`/${locale} renders the band with a whitelisted CTA href`, async ({ page }) => {
      await page.goto(`/${locale}`);

      const banner = page
        .getByRole("complementary")
        .filter({ hasText: BODY[locale] });
      await expect(banner).toBeVisible();

      const cta = banner.getByRole("link", { name: CTA_LABEL[locale] });
      await expect(cta).toHaveAttribute("href", CTA_HREF);
    });

    test(`/${locale} dismissal hides the band and persists across reloads`, async ({ page }) => {
      await page.goto(`/${locale}`);

      const banner = page
        .getByRole("complementary")
        .filter({ hasText: BODY[locale] });
      await expect(banner).toBeVisible();

      await banner.getByRole("button", { name: CLOSE_LABEL[locale] }).click();
      await expect(banner).toHaveCount(0);

      await page.reload();
      await expect(
        page.getByRole("complementary").filter({ hasText: BODY[locale] }),
      ).toHaveCount(0);
    });
  }
});
