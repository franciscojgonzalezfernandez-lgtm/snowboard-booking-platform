import { test, expect } from "@playwright/test";

// F-131 — the home hero is the mobile LCP element, so how the optimizer
// delivers it is a perf contract, not an implementation detail. These guard the
// two settings that carry it: AVIF ahead of WebP, and a curated `deviceSizes`
// list. Both live in `next.config.ts` and are easy to lose in a merge.

// Must match `images.deviceSizes` in next.config.ts.
const DEVICE_SIZES = [640, 828, 1080, 1200, 1920];

test.describe("F-131 — hero image delivery", () => {
  test("hero srcset offers exactly the configured widths", async ({ page }) => {
    await page.goto("/en");

    const srcset = await page
      .locator("main img[fetchpriority='high']")
      .first()
      .getAttribute("srcset");

    expect(srcset, "hero should ship a responsive srcset").toBeTruthy();

    const widths = [...(srcset ?? "").matchAll(/w=(\d+)/g)]
      .map((m) => Number(m[1]))
      .filter((w, i, all) => all.indexOf(w) === i)
      .sort((a, b) => a - b);

    expect(widths).toEqual(DEVICE_SIZES);
  });

  test("optimizer serves AVIF to a browser that accepts it", async ({
    request,
  }) => {
    const res = await request.get(
      "/_next/image?url=%2Fbrand%2Fhero.jpg&w=1200&q=75",
      { headers: { Accept: "image/avif,image/webp,image/apng,*/*" } },
    );

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/avif");
  });

  test("optimizer still serves WebP when AVIF is not accepted", async ({
    request,
  }) => {
    const res = await request.get(
      "/_next/image?url=%2Fbrand%2Fhero.jpg&w=1200&q=75",
      { headers: { Accept: "image/webp,*/*" } },
    );

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/webp");
  });

  test("hero keeps the LCP hints that make it discoverable", async ({
    page,
  }) => {
    await page.goto("/en");
    const hero = page.locator("main img[fetchpriority='high']").first();

    // `priority` emits the preload; `fetchpriority` is what Lighthouse's
    // request-discovery audit reads (F-124). Both must survive.
    await expect(hero).toHaveAttribute("fetchpriority", "high");
    await expect(hero).toHaveAttribute("sizes", "100vw");

    const preload = page.locator('link[rel="preload"][as="image"]');
    await expect(preload).toHaveCount(1);
  });
});
