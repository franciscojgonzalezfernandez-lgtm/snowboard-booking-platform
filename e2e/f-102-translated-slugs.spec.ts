import { test, expect } from "@playwright/test";

/**
 * F-102 — Translated slugs (next-intl `pathnames`) for the public marketing
 * pages. Only the marketing surface is localized; payment/auth/legal routes
 * (`/reservar*`, `/login`, `/terms`, `/privacy`) keep an identical slug across
 * locales and are out of scope here. `localePrefix` stays `always`, so EN URLs
 * keep the `/en` prefix.
 */

// internal pathname key → page marker → localized external slug per locale.
const PAGES = [
  {
    marker: "pricing-page",
    slug: { en: "pricing", de: "preise", es: "precios" },
  },
  {
    marker: "about-page",
    slug: { en: "about", de: "ueber-uns", es: "sobre" },
  },
  {
    marker: "instructors-page",
    slug: { en: "instructors", de: "instruktoren", es: "instructores" },
  },
  {
    marker: "contact-page",
    slug: { en: "contact", de: "kontakt", es: "contacto" },
  },
] as const;

const LOCALES = ["en", "de", "es"] as const;

test.describe("F-102 — translated marketing slugs resolve per locale", () => {
  for (const { marker, slug } of PAGES) {
    for (const locale of LOCALES) {
      test(`/${locale}/${slug[locale]} renders ${marker}`, async ({ page }) => {
        await page.goto(`/${locale}/${slug[locale]}`);
        await expect(page.getByTestId(marker)).toBeVisible();
      });
    }
  }
});

test.describe("F-102 — `Link` emits the active locale's slug", () => {
  // On a localized home, the nav anchors must point at the locale's external
  // slug (proves next-intl rewrote the internal pathname key), not the raw key.
  const NAV_SLUGS = {
    de: { about: "/de/ueber-uns", instructors: "/de/instruktoren", pricing: "/de/preise", contact: "/de/kontakt" },
    es: { about: "/es/sobre", instructors: "/es/instructores", pricing: "/es/precios", contact: "/es/contacto" },
  } as const;

  for (const locale of ["de", "es"] as const) {
    test(`${locale} nav links use translated slugs`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const nav = page.getByTestId("site-nav");
      await expect(nav.locator(`a[href="${NAV_SLUGS[locale].about}"]`)).toBeVisible();
      await expect(nav.locator(`a[href="${NAV_SLUGS[locale].instructors}"]`)).toBeVisible();
      await expect(nav.locator(`a[href="${NAV_SLUGS[locale].pricing}"]`)).toBeVisible();
      await expect(page.getByTestId("site-nav-contact")).toHaveAttribute(
        "href",
        NAV_SLUGS[locale].contact,
      );
    });
  }
});

test.describe("F-102 — non-canonical slug redirects to the locale's canonical slug", () => {
  // next-intl normalizes the internal key or another locale's slug to the
  // current locale's canonical slug (no duplicate-content leak): a 307 to the
  // right URL rather than serving the page at two paths.
  const REDIRECTS = [
    { from: "/en/sobre", to: "/en/about" },
    { from: "/de/about", to: "/de/ueber-uns" },
    { from: "/es/pricing", to: "/es/precios" },
    { from: "/de/instructores", to: "/de/instruktoren" },
  ];
  for (const { from, to } of REDIRECTS) {
    test(`${from} → ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = res.headers()["location"];
      expect(location).toBeTruthy();
      const pathname = location!.startsWith("http")
        ? new URL(location!).pathname
        : location!;
      expect(pathname).toBe(to);
    });
  }
});

test.describe("F-102 — language switcher preserves a translated route", () => {
  test("EN /en/about → DE /de/ueber-uns keeps the About page", async ({
    page,
  }) => {
    await page.goto("/en/about");
    await expect(page.getByTestId("about-page")).toBeVisible();

    await page.getByTestId("lang-de").first().click();
    await page.waitForURL(/\/de\/ueber-uns\/?$/);
    await expect(page.getByTestId("about-page")).toBeVisible();

    await page.getByTestId("lang-es").first().click();
    await page.waitForURL(/\/es\/sobre\/?$/);
    await expect(page.getByTestId("about-page")).toBeVisible();
  });
});
