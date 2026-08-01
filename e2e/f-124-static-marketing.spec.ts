import { test, expect } from "@playwright/test";

/**
 * F-124 — the marketing tree must stay statically rendered and CDN-cacheable.
 *
 * It regressed into `no-store` because two server components reached for
 * request-scoped data: the root layout resolved the locale from the request, and
 * `SiteNav` read the session. Every marketing route then answered
 * `no-store` with a permanent CDN miss, which was ~45% of the home's LCP. These
 * assertions are the guard: they fail the moment a dynamic API creeps back into
 * a layout the public pages share.
 */

const MARKETING_PATHS = [
  "/en",
  "/de",
  "/es",
  "/en/pricing",
  "/de/preise",
  "/es/precios",
  "/en/faq",
  "/en/blog",
];

/** Routes that MUST stay dynamic — they render per-visitor state. */
const DYNAMIC_PATHS = ["/en/login", "/en/dashboard", "/en/reservar"];

// `next dev` always answers `no-store`, so the cache assertions only mean
// something against a real build. They run when the suite is pointed at one
// (PLAYWRIGHT_BASE_URL — a preview deployment, or a local `next build && start`).
const againstBuild = !!process.env.PLAYWRIGHT_BASE_URL;

test.describe("F-124 — marketing stays static and cacheable", () => {
  test.skip(
    !againstBuild,
    "cache-control is only meaningful against a production build; set PLAYWRIGHT_BASE_URL",
  );

  for (const path of MARKETING_PATHS) {
    test(`${path} is CDN-cacheable`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);

      const cacheControl = response.headers()["cache-control"] ?? "";
      expect(cacheControl).not.toContain("no-store");
      expect(cacheControl).toMatch(/s-maxage=\d+/);
    });
  }

  for (const path of DYNAMIC_PATHS) {
    test(`${path} stays dynamic`, async ({ request }) => {
      const response = await request.get(path);
      const cacheControl = response.headers()["cache-control"] ?? "";
      expect(cacheControl).toContain("no-store");
    });
  }
});

test.describe("F-124 — home LCP", () => {
  test("hero image carries the high priority hint", async ({ page }) => {
    await page.goto("/es");

    const hero = page.locator("main section img").first();
    await expect(hero).toHaveAttribute("fetchpriority", "high");
    // `priority` also has to keep emitting the preload, which is what makes the
    // request discoverable before the image element is laid out.
    await expect(
      page.locator('link[rel="preload"][as="image"]'),
    ).toHaveCount(1);
  });

  test("html lang matches the locale on every prerendered locale", async ({
    page,
  }) => {
    for (const locale of ["en", "de", "es"] as const) {
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    }
  });

  test("settles with no layout shift once the auth island resolves", async ({
    page,
  }) => {
    await page.goto("/es");

    // The auth CTA is a client island now (it used to be server-rendered from
    // the session). If its reserved width is ever dropped, the nav — and the
    // hero right under it — shift as the session resolves.
    const shift = await page.evaluate(async () => {
      let total = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!layoutShift.hadRecentInput) total += layoutShift.value;
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
      await new Promise((resolve) => setTimeout(resolve, 2500));
      observer.disconnect();
      return total;
    });

    expect(shift).toBeLessThan(0.1);
    await expect(page.getByTestId("site-nav-signin")).toBeVisible();
  });
});
