import { test, expect } from "@playwright/test";

// F-103 — per-route conversion metadata: keyword-tuned title, canonical, and
// hreflang alternates (incl. x-default) on every marketing page, derived from
// the F-102 pathnames map. URLs carry the production origin (SITE_URL via
// metadataBase) even when served from localhost.
const ORIGIN = "https://rideflumserberg.ch";

/** head <link rel="alternate"> hrefs by hreflang, for the current page. */
async function alternates(page: import("@playwright/test").Page) {
  return page.$$eval('link[rel="alternate"][hreflang]', (links) =>
    Object.fromEntries(
      links.map((l) => [
        l.getAttribute("hreflang"),
        l.getAttribute("href"),
      ]),
    ),
  );
}

async function canonical(page: import("@playwright/test").Page) {
  return page.getAttribute('link[rel="canonical"]', "href");
}

test.describe("F-103 — marketing metadata", () => {
  test("home: keyword-tuned title + self canonical + hreflang", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/Private snowboard lessons in Flumserberg/);
    expect(await canonical(page)).toBe(`${ORIGIN}/en`);
    const alt = await alternates(page);
    expect(alt).toMatchObject({
      en: `${ORIGIN}/en`,
      de: `${ORIGIN}/de`,
      es: `${ORIGIN}/es`,
      "x-default": `${ORIGIN}/en`,
    });
  });

  test("pricing: canonical + hreflang follow the translated slug per locale", async ({
    page,
  }) => {
    await page.goto("/de/preise");
    expect(await canonical(page)).toBe(`${ORIGIN}/de/preise`);
    const alt = await alternates(page);
    expect(alt).toMatchObject({
      en: `${ORIGIN}/en/pricing`,
      de: `${ORIGIN}/de/preise`,
      es: `${ORIGIN}/es/precios`,
      "x-default": `${ORIGIN}/en/pricing`,
    });
  });

  test("about (es): localized title + self canonical on the translated slug", async ({
    page,
  }) => {
    await page.goto("/es/sobre");
    expect(await canonical(page)).toBe(`${ORIGIN}/es/sobre`);
    await expect(page).toHaveTitle(/clases de snowboard/i);
  });

  test("faq (en) exposes canonical + x-default", async ({ page }) => {
    await page.goto("/en/faq");
    expect(await canonical(page)).toBe(`${ORIGIN}/en/faq`);
    const alt = await alternates(page);
    expect(alt["x-default"]).toBe(`${ORIGIN}/en/faq`);
  });
});
