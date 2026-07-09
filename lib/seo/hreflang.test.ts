import { describe, expect, it } from "vitest";

import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangAlternates, localizedPath } from "@/lib/seo/hreflang";

describe("localizedPath", () => {
  it("collapses the home route to just the locale prefix (no trailing slash)", () => {
    expect(localizedPath("/", "en")).toBe("/en");
    expect(localizedPath("/", "de")).toBe("/de");
  });

  it("emits the translated slug per locale (F-102 pathnames map)", () => {
    expect(localizedPath("/precios", "en")).toBe("/en/pricing");
    expect(localizedPath("/precios", "de")).toBe("/de/preise");
    expect(localizedPath("/precios", "es")).toBe("/es/precios");
  });

  it("keeps universal slugs identical across locales", () => {
    expect(localizedPath("/faq", "en")).toBe("/en/faq");
    expect(localizedPath("/faq", "de")).toBe("/de/faq");
  });

  it("substitutes dynamic [param] segments", () => {
    expect(localizedPath("/instructores/[slug]", "de", { slug: "javi" })).toBe(
      "/de/instruktoren/javi",
    );
    expect(localizedPath("/instructores/[slug]", "en", { slug: "javi" })).toBe(
      "/en/instructors/javi",
    );
  });
});

describe("hreflangAlternates", () => {
  it("builds absolute canonical (default locale) + full languages map + x-default", () => {
    const { canonical, languages } = hreflangAlternates("/precios");

    expect(canonical).toBe(`${SITE_URL}/en/pricing`);
    expect(languages).toEqual({
      en: `${SITE_URL}/en/pricing`,
      de: `${SITE_URL}/de/preise`,
      es: `${SITE_URL}/es/precios`,
      "x-default": `${SITE_URL}/en/pricing`,
    });
  });

  it("threads params through every locale", () => {
    const { languages } = hreflangAlternates("/instructores/[slug]", {
      slug: "javi",
    });

    expect(languages).toEqual({
      en: `${SITE_URL}/en/instructors/javi`,
      de: `${SITE_URL}/de/instruktoren/javi`,
      es: `${SITE_URL}/es/instructores/javi`,
      "x-default": `${SITE_URL}/en/instructors/javi`,
    });
  });

  it("x-default always points at the default locale", () => {
    const { languages } = hreflangAlternates("/");
    expect(languages["x-default"]).toBe(languages.en);
    expect(languages.en).toBe(`${SITE_URL}/en`);
  });
});
