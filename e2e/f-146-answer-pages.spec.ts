import fs from "node:fs";
import path from "node:path";

import { test, expect } from "@playwright/test";
import matter from "gray-matter";

// F-146 — answer pages that win the query clusters where competitors surface and
// we don't (GenScore recs 1.1, 2.3, 2.4, 2.5). Each cluster ships as an
// answer-first blog post in all three locales (same frontmatter `id`, localized
// `slug`), leading with the question as its H1, answering in the lead paragraph,
// and emitting FAQPage JSON-LD so the answer can surface in AI/search answers.
//
// Positioning is by our own merits: no post publishes a head-to-head comparison
// or names a competitor. This spec guards both the wiring and that rule.

const LOCALES = ["en", "de", "es"] as const;
type Locale = (typeof LOCALES)[number];

/** The seven F-146 clusters, keyed by shared frontmatter `id`, with each
 * locale's localized slug. Titles/FAQ text are read from the MDX at run time so
 * the expectations can never drift from the published copy. */
const POSTS: Record<string, Record<Locale, string>> = {
  "small-group-lessons": {
    en: "small-group-snowboard-lessons",
    de: "snowboardkurse-kleingruppe",
    es: "clases-snowboard-grupos-reducidos",
  },
  "family-lessons": {
    en: "family-snowboard-lessons-flumserberg",
    de: "snowboarden-lernen-familie-flumserberg",
    es: "clases-snowboard-familias-flumserberg",
  },
  "kids-private-lessons": {
    en: "private-snowboard-lessons-kids",
    de: "privater-snowboardkurs-kinder",
    es: "clases-particulares-snowboard-ninos",
  },
  "full-day-price": {
    en: "full-day-snowboard-lesson-price",
    de: "snowboardkurs-ganztags-preis",
    es: "precio-clase-snowboard-dia-completo",
  },
  "private-vs-ski-school": {
    en: "private-instructor-or-ski-school",
    de: "privater-lehrer-oder-skischule",
    es: "profesor-particular-o-escuela-esqui",
  },
  "choosing-lessons": {
    en: "how-to-choose-snowboard-lessons-flumserberg",
    de: "snowboardkurs-auswaehlen-flumserberg",
    es: "como-elegir-clases-snowboard-flumserberg",
  },
  "your-instructor": {
    en: "snowboard-instructors-flumserberg",
    de: "snowboardlehrer-flumserberg",
    es: "profesores-snowboard-flumserberg",
  },
};

// Competitor names/domains the copy must never publish (AC 2.5 — positioning by
// our own merits, no head-to-head). The brand "Start Snowboarding" is matched
// case-sensitively so the ordinary verb phrase "start snowboarding" (which the
// copy does use, e.g. "when children start snowboarding") never trips it.
const FORBIDDEN_NAMES = [
  /startsnowboarding/i, // startsnowboarding.ch (domain)
  /Start Snowboarding/, // brand, title-cased — a mid-sentence verb is not
  /\bskifun\b/i,
  /ski-fun/i, // ski-fun.ch
  /checkyeti/i, // checkyeti.com
  /check yeti/i,
  /\bsuperprof\b/i,
  /maison sport/i,
];

const CONTENT_ROOT = path.join(process.cwd(), "content", "blog");

type Frontmatter = {
  id: string;
  slug: string;
  title: string;
  faq?: { q: string; a: string }[];
};

function readFrontmatter(locale: Locale, slug: string): Frontmatter {
  const file = path.join(CONTENT_ROOT, locale, `${slug}.mdx`);
  const { data } = matter(fs.readFileSync(file, "utf8"));
  return data as Frontmatter;
}

async function jsonLdNodes(
  page: import("@playwright/test").Page,
): Promise<Record<string, unknown>[]> {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return scripts.map((s) => JSON.parse(s) as Record<string, unknown>);
}

type FaqNode = {
  "@type": string;
  mainEntity: {
    "@type": string;
    name: string;
    acceptedAnswer: { "@type": string; text: string };
  }[];
};

test.describe("F-146 — answer pages by query cluster", () => {
  for (const [id, slugs] of Object.entries(POSTS)) {
    for (const locale of LOCALES) {
      const slug = slugs[locale];

      test(`${id} — /${locale}/blog/${slug} answers first with FAQPage JSON-LD`, async ({
        page,
      }) => {
        const fm = readFrontmatter(locale, slug);
        expect(fm.id, `frontmatter id for ${locale}/${slug}`).toBe(id);
        expect(
          fm.faq && fm.faq.length,
          `${locale}/${slug} must ship faq frontmatter`,
        ).toBeTruthy();

        const res = await page.goto(`/${locale}/blog/${slug}`);
        expect(res?.status(), `${locale}/${slug} should return 200`).toBe(200);

        const main = page.getByTestId("blog-post");
        await expect(main).toBeVisible();
        await expect(main).toHaveAttribute("data-post-id", id);

        // Lead with the question as H1; the direct answer follows immediately.
        await expect(page.locator("h1")).toContainText(fm.title);

        // CTA drops into the funnel in the active locale.
        await expect(page.getByTestId("blog-cta")).toHaveAttribute(
          "href",
          `/${locale}/reservar`,
        );

        // FAQPage JSON-LD present and its first entry mirrors the H1 exactly.
        const nodes = await jsonLdNodes(page);
        const faq = nodes.find((n) => n["@type"] === "FAQPage") as
          | FaqNode
          | undefined;
        expect(faq, "FAQPage JSON-LD should be present").toBeTruthy();
        expect(faq!.mainEntity[0]!.name).toBe(fm.title);
        for (const entry of faq!.mainEntity) {
          expect(entry["@type"]).toBe("Question");
          expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0);
        }

        // Positioning by own merits — no competitor named anywhere on the page.
        const bodyText = await page.locator("body").innerText();
        for (const rx of FORBIDDEN_NAMES) {
          expect(
            rx.test(bodyText),
            `${locale}/${slug} must not name a competitor (${rx})`,
          ).toBe(false);
        }
      });

      test(`${id} — /${locale}/blog/${slug} carries reciprocal hreflang`, async ({
        page,
      }) => {
        await page.goto(`/${locale}/blog/${slug}`);
        for (const loc of LOCALES) {
          await expect(
            page.locator(`link[rel="alternate"][hreflang="${loc}"]`),
          ).toHaveAttribute("href", new RegExp(`/${loc}/blog/${slugs[loc]}$`));
        }
        await expect(
          page.locator('link[rel="alternate"][hreflang="x-default"]'),
        ).toHaveAttribute("href", new RegExp(`/en/blog/${slugs.en}$`));
      });
    }
  }

  test("all F-146 posts are listed in the sitemap for every locale", async ({
    page,
  }) => {
    const res = await page.goto("/sitemap.xml");
    expect(res?.status()).toBe(200);
    const xml = await page.content();
    for (const slugs of Object.values(POSTS)) {
      for (const locale of LOCALES) {
        expect(
          xml.includes(`/${locale}/blog/${slugs[locale]}`),
          `sitemap should list /${locale}/blog/${slugs[locale]}`,
        ).toBe(true);
      }
    }
  });
});
