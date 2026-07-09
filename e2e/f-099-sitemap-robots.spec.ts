import { test, expect } from "@playwright/test";

// F-099 — the sitemap and robots are built from the production origin
// (SITE_URL = https://rideflumserberg.ch via metadataBase), so the emitted URLs
// carry that host even when served from localhost.
const ORIGIN = "https://rideflumserberg.ch";

test.describe("F-099 — sitemap", () => {
  test("/sitemap.xml returns localized URLs with hreflang alternates", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");

    const body = await res.text();

    // Home + translated marketing slugs, one <url> per locale (F-102 map).
    expect(body).toContain(`<loc>${ORIGIN}/en</loc>`);
    expect(body).toContain(`${ORIGIN}/en/pricing`);
    expect(body).toContain(`${ORIGIN}/de/preise`);
    expect(body).toContain(`${ORIGIN}/es/precios`);
    expect(body).toContain(`${ORIGIN}/de/ueber-uns`);

    // hreflang alternates, including x-default.
    expect(body).toContain('hreflang="de"');
    expect(body).toContain('hreflang="x-default"');

    // Authenticated / funnel routes must never appear in the index.
    expect(body).not.toContain("/reservar");
    expect(body).not.toContain("/dashboard");
    expect(body).not.toContain("/admin");
  });
});

test.describe("F-099 — robots", () => {
  test("/robots.txt allows public, disallows private/funnel, points to sitemap", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");

    const body = await res.text();

    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /instructor");
    expect(body).toContain("Disallow: /api");
    // Locale-prefixed private areas.
    expect(body).toContain("Disallow: /en/reservar");
    expect(body).toContain("Disallow: /de/dashboard");

    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});
