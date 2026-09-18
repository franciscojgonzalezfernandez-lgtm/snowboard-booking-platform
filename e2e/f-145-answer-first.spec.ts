import { test, expect } from "@playwright/test";

// F-145 — answer-first Q&A posts. The first target query (1.2, +4 pt) shipped as
// a blog post in all three locales, sharing frontmatter id "adult-levels". Each
// page must: lead with the question as its H1, answer directly in the lead
// paragraph, and emit BOTH BlogPosting and FAQPage JSON-LD (the FAQPage lets the
// answer surface in AI/search answers). Reciprocal hreflang across locales.

const LOCALES = ["en", "de", "es"] as const;
type Locale = (typeof LOCALES)[number];

const POST: Record<Locale, { slug: string; q: string; lead: string }> = {
  en: {
    slug: "snowboard-lessons-adults-by-level",
    q: "How are snowboard lessons for adults with different experience levels organised?",
    lead: "By level and goal, not by age",
  },
  de: {
    slug: "snowboardkurse-erwachsene-nach-level",
    q: "Wie sind Snowboardkurse für Erwachsene mit unterschiedlichem Level aufgebaut?",
    lead: "Nach Level und Ziel, nicht nach Alter",
  },
  es: {
    slug: "clases-snowboard-adultos-por-nivel",
    q: "¿Cómo se organizan las clases de snowboard para adultos con diferentes niveles?",
    lead: "Por nivel y por objetivo, no por edad",
  },
};

type FaqNode = {
  "@type": string;
  mainEntity: {
    "@type": string;
    name: string;
    acceptedAnswer: { "@type": string; text: string };
  }[];
};
type BlogPostingNode = { "@type": string; headline: string };

/** Parse every ld+json script on the page into plain objects. */
async function jsonLdNodes(
  page: import("@playwright/test").Page,
): Promise<Record<string, unknown>[]> {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return scripts.map((s) => JSON.parse(s) as Record<string, unknown>);
}

test.describe("F-145 — answer-first Q&A post (adult levels)", () => {
  for (const locale of LOCALES) {
    const { slug, q, lead } = POST[locale];

    test(`/${locale}/blog/${slug} leads with the question and answers first`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/blog/${slug}`);

      const main = page.getByTestId("blog-post");
      await expect(main).toBeVisible();
      await expect(main).toHaveAttribute("data-post-id", "adult-levels");

      // H1 is the question; the direct answer leads immediately after it.
      await expect(page.locator("h1")).toContainText(q);
      await expect(page.getByText(lead).first()).toBeVisible();

      // CTA into the funnel.
      await expect(page.getByTestId("blog-cta")).toHaveAttribute(
        "href",
        `/${locale}/reservar`,
      );
    });

    test(`/${locale}/blog/${slug} emits BlogPosting + FAQPage JSON-LD`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/blog/${slug}`);
      const nodes = await jsonLdNodes(page);

      const blogPosting = nodes.find((n) => n["@type"] === "BlogPosting") as
        | BlogPostingNode
        | undefined;
      expect(blogPosting, "BlogPosting JSON-LD should be present").toBeTruthy();
      expect(blogPosting!.headline).toBe(q);

      const faq = nodes.find((n) => n["@type"] === "FAQPage") as
        | FaqNode
        | undefined;
      expect(faq, "FAQPage JSON-LD should be present").toBeTruthy();
      expect(Array.isArray(faq!.mainEntity)).toBe(true);
      expect(faq!.mainEntity.length).toBeGreaterThanOrEqual(1);
      // First question mirrors the H1 — structured data can't drift from copy.
      expect(faq!.mainEntity[0]!.name).toBe(q);
      for (const entry of faq!.mainEntity) {
        expect(entry["@type"]).toBe("Question");
        expect(typeof entry.name).toBe("string");
        expect(entry.acceptedAnswer["@type"]).toBe("Answer");
        expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0);
      }
    });

    test(`/${locale}/blog/${slug} carries reciprocal hreflang alternates`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/blog/${slug}`);
      for (const loc of LOCALES) {
        const link = page.locator(`link[rel="alternate"][hreflang="${loc}"]`);
        await expect(link).toHaveAttribute(
          "href",
          new RegExp(`/${loc}/blog/${POST[loc].slug}$`),
        );
      }
      // x-default points at the English version (default locale / master voice).
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute("href", new RegExp(`/en/blog/${POST.en.slug}$`));
    });
  }
});
