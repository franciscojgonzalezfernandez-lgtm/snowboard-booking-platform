import { describe, expect, it } from "vitest";

import { SITE_URL } from "@/lib/seo/site-url";
import {
  SITE_NAME,
  articleOpenGraph,
  marketingOpenGraph,
} from "@/lib/seo/page-metadata";

// F-120 — the shared metadata helper now emits a complete Open Graph set
// (og:url/og:type/og:site_name/og:locale + og:locale:alternate) that Ahrefs
// flagged as missing on every marketing URL and blog post.

describe("SITE_NAME", () => {
  it("is the canonical brand (single source: BUSINESS identity)", () => {
    expect(SITE_NAME).toBe("Ride Flumserberg");
  });
});

describe("marketingOpenGraph", () => {
  it("emits a complete website OG set with a self-referential url (translated slug)", () => {
    const og = marketingOpenGraph("/precios", "de");
    expect(og).toMatchObject({
      type: "website",
      siteName: "Ride Flumserberg",
      url: `${SITE_URL}/de/preise`,
      locale: "de",
    });
    // og:locale:alternate = the OTHER locales, current one excluded.
    expect(og?.alternateLocale).toEqual(["en", "es"]);
  });

  it("collapses the home route url to just the locale prefix", () => {
    const og = marketingOpenGraph("/", "en");
    expect(og?.url).toBe(`${SITE_URL}/en`);
    expect(og?.alternateLocale).toEqual(["de", "es"]);
  });

  it("threads dynamic [param] segments through the og:url", () => {
    const og = marketingOpenGraph("/instructores/[slug]", "es", {
      slug: "javi",
    });
    expect(og?.url).toBe(`${SITE_URL}/es/instructores/javi`);
  });
});

describe("articleOpenGraph", () => {
  it("emits an article OG set with site_name, self url, locale and published time", () => {
    const url = `${SITE_URL}/en/blog/your-first-day-on-a-snowboard`;
    const og = articleOpenGraph({
      url,
      locale: "en",
      publishedTime: "2026-01-15",
      alternateLocales: ["de", "es"],
    });
    expect(og).toMatchObject({
      type: "article",
      siteName: "Ride Flumserberg",
      url,
      locale: "en",
      publishedTime: "2026-01-15",
    });
    expect(og?.alternateLocale).toEqual(["de", "es"]);
  });
});
