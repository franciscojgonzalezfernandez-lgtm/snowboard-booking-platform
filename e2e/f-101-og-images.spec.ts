import { test, expect } from "@playwright/test";

// F-101 — dynamic OG/Twitter images per marketing route × locale. We resolve the
// real image URL from each page's `<meta>` (Next mints a hashed path) and assert
// the asset renders as a 1200×630 PNG. Slugs are not translated yet (F-102), so
// segments are shared across locales.
const LOCALES = ["en", "de", "es"] as const;

const ROUTES = [
  "", // home
  "precios",
  "instructores",
  "instructores/javi", // seeded owner profile
  "sobre",
  "contacto",
  "faq",
] as const;

// routing.ts uses `localePrefix: "always"`, so every locale (EN included) is
// prefixed. F-102 may later drop the EN prefix; the OG meta follows next-intl
// automatically, so only this URL builder would change.
function pageUrl(locale: string, segment: string): string {
  return `/${locale}/${segment}`.replace(/\/$/, "");
}

test.describe("F-101 — dynamic OG images", () => {
  for (const locale of LOCALES) {
    for (const segment of ROUTES) {
      const path = pageUrl(locale, segment);

      test(`${path} exposes a 1200×630 PNG og:image + twitter:image`, async ({
        page,
        request,
      }) => {
        const ogImage = page.locator('meta[property="og:image"]');
        const twitterImage = page.locator('meta[name="twitter:image"]');

        // In dev, Next compiles the `opengraph-image` route lazily — a cold
        // route can render the page HTML before the image module is built, so
        // the meta is briefly absent. Re-navigate until it resolves (instant
        // against a production build).
        await expect(async () => {
          await page.goto(path);
          await expect(ogImage).toHaveCount(1);
        }).toPass({ timeout: 20_000 });

        await expect(twitterImage).toHaveCount(1);

        // Dimensions advertised in metadata.
        await expect(
          page.locator('meta[property="og:image:width"]'),
        ).toHaveAttribute("content", "1200");
        await expect(
          page.locator('meta[property="og:image:height"]'),
        ).toHaveAttribute("content", "630");

        const src = await ogImage.getAttribute("content");
        expect(src).toBeTruthy();

        // metadataBase makes og:image absolute (prod host). Request only the
        // path so it resolves against the test baseURL (local dev), not prod.
        const { pathname, search } = new URL(src!);
        const res = await request.get(`${pathname}${search}`);
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toContain("image/png");
        // A real render is comfortably larger than an error stub.
        expect((await res.body()).byteLength).toBeGreaterThan(3_000);
      });
    }
  }
});
