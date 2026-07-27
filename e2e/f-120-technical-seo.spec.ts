import { test, expect, type Page } from "@playwright/test";

// F-120 — Ahrefs technical fixes:
//  1. a SINGLE hreflang emitter — the next-intl middleware no longer sends the
//     HTTP `Link` header with alternates (alternateLinks: false), leaving the
//     F-103 HTML `<link rel="alternate">` set as the only source of truth.
//  2. a COMPLETE Open Graph set on marketing pages (og:url/type/site_name/locale)
//     and blog posts (og:type=article).
//  3. `/login` is noindex with the current brand in its title.
// URLs carry the production origin (SITE_URL via metadataBase) even on localhost.
const ORIGIN = "https://rideflumserberg.ch";

function ogContent(page: Page, property: string) {
  return page.getAttribute(`meta[property="${property}"]`, "content");
}

test.describe("F-120 — single hreflang emitter", () => {
  test("/en/pricing does not send an HTTP Link header with hreflang", async ({
    page,
  }) => {
    const response = await page.goto("/en/pricing");
    expect(response).not.toBeNull();
    // A `Link` header may still exist for asset preloads — it just must not
    // carry hreflang alternates anymore (those live only in the HTML head).
    const link = response!.headers()["link"] ?? "";
    expect(link).not.toContain("hreflang");
  });

  test("the HTML <link rel=alternate hreflang> set survives (F-103)", async ({
    page,
  }) => {
    await page.goto("/en/pricing");
    const alt = await page.$$eval(
      'link[rel="alternate"][hreflang]',
      (links) =>
        Object.fromEntries(
          links.map((l) => [l.getAttribute("hreflang"), l.getAttribute("href")]),
        ),
    );
    expect(alt).toMatchObject({
      en: `${ORIGIN}/en/pricing`,
      de: `${ORIGIN}/de/preise`,
      es: `${ORIGIN}/es/precios`,
      "x-default": `${ORIGIN}/en/pricing`,
    });
  });
});

test.describe("F-120 — complete Open Graph", () => {
  test("marketing page emits og:url (= canonical), type, site_name, locale", async ({
    page,
  }) => {
    await page.goto("/de/preise");
    const canonical = await page.getAttribute('link[rel="canonical"]', "href");
    expect(await ogContent(page, "og:url")).toBe(`${ORIGIN}/de/preise`);
    expect(await ogContent(page, "og:url")).toBe(canonical);
    expect(await ogContent(page, "og:type")).toBe("website");
    expect(await ogContent(page, "og:site_name")).toBe("Ride Flumserberg");
    expect(await ogContent(page, "og:locale")).toBe("de");
  });

  test("blog post emits og:type=article + og:site_name", async ({ page }) => {
    await page.goto("/en/blog/your-first-day-on-a-snowboard");
    expect(await ogContent(page, "og:type")).toBe("article");
    expect(await ogContent(page, "og:site_name")).toBe("Ride Flumserberg");
    expect(await ogContent(page, "og:url")).toBe(
      `${ORIGIN}/en/blog/your-first-day-on-a-snowboard`,
    );
  });
});

test.describe("F-120 — /login is noindex + branded", () => {
  for (const [locale, brandedTitle] of [
    ["en", "Sign in — Ride Flumserberg"],
    ["de", "Anmelden — Ride Flumserberg"],
    ["es", "Iniciar sesión — Ride Flumserberg"],
  ] as const) {
    test(`/${locale}/login`, async ({ page }) => {
      await page.goto(`/${locale}/login`);
      const robots = await page.getAttribute('meta[name="robots"]', "content");
      expect(robots).toContain("noindex");
      await expect(page).toHaveTitle(brandedTitle);
    });
  }
});
