import { test, expect } from "@playwright/test";

// F-109 — dynamic OG/Twitter images per blog post × locale. Mirrors the F-101
// approach (resolve the hashed image URL from each page's `<meta>`, assert the
// asset renders as a 1200×630 PNG), but the blog `[slug]` is localized content
// (frontmatter `slug` per locale, shared `id`), so we walk one post's real slug
// in each language rather than a shared segment.

// One post ("first day", id: first-day) across the three locales. Blog slugs are
// translated content — different mechanism than the F-102 `pathnames` map.
const POST_SLUGS = {
  en: "your-first-day-on-a-snowboard",
  de: "dein-erster-tag-auf-dem-snowboard",
  es: "tu-primer-dia-en-snowboard",
} as const;

test.describe("F-109 — dynamic blog OG images", () => {
  // Cold `next dev` compiles each blog route (~13s) and the satori OG module
  // lazily on first hit; three parallel workers contend on a cold server. Give
  // the group room so a cold run passes standalone (warm/CI runs stay fast).
  test.describe.configure({ timeout: 60_000 });

  for (const [locale, slug] of Object.entries(POST_SLUGS)) {
    const path = `/${locale}/blog/${slug}`;

    test(`${path} exposes a 1200×630 PNG og:image + twitter:image`, async ({
      page,
      request,
    }) => {
      const ogImage = page.locator('meta[property="og:image"]');
      const twitterImage = page.locator('meta[name="twitter:image"]');

      // In dev, Next compiles the `opengraph-image` route lazily — a cold route
      // can render the page HTML before the image module is built, so the meta
      // is briefly absent. Re-navigate until it resolves (instant against a
      // production build).
      await expect(async () => {
        await page.goto(path);
        await expect(ogImage).toHaveCount(1);
      }).toPass({ timeout: 45_000 });

      await expect(twitterImage).toHaveCount(1);

      await expect(
        page.locator('meta[property="og:image:width"]'),
      ).toHaveAttribute("content", "1200");
      await expect(
        page.locator('meta[property="og:image:height"]'),
      ).toHaveAttribute("content", "630");

      const src = await ogImage.getAttribute("content");
      expect(src).toBeTruthy();

      // metadataBase makes og:image absolute (prod host). Request only the path
      // so it resolves against the test baseURL (local dev), not prod.
      const { pathname, search } = new URL(src!);
      const res = await request.get(`${pathname}${search}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      // A real render is comfortably larger than an error stub.
      expect((await res.body()).byteLength).toBeGreaterThan(3_000);
    });
  }
});
