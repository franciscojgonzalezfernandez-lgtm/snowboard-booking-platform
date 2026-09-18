import { test, expect } from "@playwright/test";

// F-145 — answer-first Q&A posts. Each target query (the +27 pt "empty query"
// bucket) ships as a blog post in all three locales, sharing a frontmatter id.
// Overlapping queries are consolidated into one rich page (each sub-question
// still lives in the FAQPage JSON-LD). Every page must: lead with the question
// as its H1, answer directly in the lead paragraph, emit BOTH BlogPosting and
// FAQPage JSON-LD, and carry reciprocal hreflang across locales.

const LOCALES = ["en", "de", "es"] as const;
type Locale = (typeof LOCALES)[number];
type LocaleData = { slug: string; q: string; lead: string };
type PostEntry = { id: string } & Record<Locale, LocaleData>;

const POSTS: PostEntry[] = [
  {
    id: "adult-levels",
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
  },
  {
    id: "advanced-coaching",
    en: {
      slug: "improve-carving-snowboard-instructor",
      q: "How can I improve my snowboard carving technique with an instructor?",
      lead: "fixing the cause, not the symptom",
    },
    de: {
      slug: "carving-snowboard-verbessern-lehrer",
      q: "Wie kann ich meine Carving-Technik auf dem Snowboard mit einem Lehrer verbessern?",
      lead: "die Ursache angeht, nicht das Symptom",
    },
    es: {
      slug: "mejorar-carving-snowboard-instructor",
      q: "¿Cómo puedo mejorar mi técnica de carving en snowboard con un instructor?",
      lead: "atacando la causa, no el síntoma",
    },
  },
  {
    id: "learn-options",
    en: {
      slug: "best-ways-to-learn-snowboarding",
      q: "What are the best ways to learn snowboarding?",
      lead: "There are four real paths",
    },
    de: {
      slug: "snowboard-lernen-beste-optionen",
      q: "Was sind die besten Möglichkeiten, Snowboarden zu lernen?",
      lead: "Es gibt vier echte Wege",
    },
    es: {
      slug: "mejores-opciones-aprender-snowboard",
      q: "¿Cuáles son las mejores opciones para aprender a hacer snowboard?",
      lead: "Hay cuatro caminos reales",
    },
  },
];

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

test.describe("F-145 — answer-first Q&A posts", () => {
  for (const post of POSTS) {
    for (const locale of LOCALES) {
      const { slug, q, lead } = post[locale];

      test(`/${locale}/blog/${slug} leads with the question and answers first`, async ({
        page,
      }) => {
        await page.goto(`/${locale}/blog/${slug}`);

        const main = page.getByTestId("blog-post");
        await expect(main).toBeVisible();
        await expect(main).toHaveAttribute("data-post-id", post.id);

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
          await expect(
            page.locator(`link[rel="alternate"][hreflang="${loc}"]`),
          ).toHaveAttribute("href", new RegExp(`/${loc}/blog/${post[loc].slug}$`));
        }
        // x-default points at the English version (default locale / master voice).
        await expect(
          page.locator('link[rel="alternate"][hreflang="x-default"]'),
        ).toHaveAttribute("href", new RegExp(`/en/blog/${post.en.slug}$`));
      });
    }
  }
});
