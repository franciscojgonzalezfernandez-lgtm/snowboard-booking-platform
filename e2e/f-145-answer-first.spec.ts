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
    id: "group-vs-private",
    en: {
      slug: "group-vs-private-snowboard-lesson",
      q: "What's the difference between a group and a private snowboard lesson?",
      lead: "the difference is focus",
    },
    de: {
      slug: "snowboard-gruppenkurs-vs-privat",
      q: "Was ist der Unterschied zwischen einem Snowboard-Gruppenkurs und einer Privatstunde?",
      lead: "der Unterschied ist der Fokus",
    },
    es: {
      slug: "clase-snowboard-grupal-vs-privada",
      q: "¿Qué diferencia hay entre una clase de snowboard grupal y una privada?",
      lead: "la diferencia es el foco",
    },
  },
  {
    id: "choosing-instructor",
    en: {
      slug: "choosing-private-snowboard-instructor",
      q: "What should I look for when choosing a private snowboard instructor?",
      lead: "Look at three things",
    },
    de: {
      slug: "privaten-snowboardlehrer-auswaehlen",
      q: "Worauf sollte ich bei der Wahl eines privaten Snowboardlehrers achten?",
      lead: "Achte auf drei Dinge",
    },
    es: {
      slug: "como-elegir-instructor-snowboard-privado",
      q: "¿Qué debo considerar al elegir un instructor privado de snowboard?",
      lead: "Mira tres cosas",
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
      lead: "a coach who watches and films you",
    },
    de: {
      slug: "snowboard-lernen-beste-optionen",
      q: "Was sind die besten Möglichkeiten, Snowboarden zu lernen?",
      lead: "Coach, der dich sieht und filmt",
    },
    es: {
      slug: "mejores-opciones-aprender-snowboard",
      q: "¿Cuáles son las mejores opciones para aprender a hacer snowboard?",
      lead: "un coach que te ve y te graba",
    },
  },
  {
    id: "private-prices",
    en: {
      slug: "private-snowboard-lesson-price",
      q: "How much does a private snowboard lesson cost in Flumserberg?",
      lead: "A 1-hour private lesson costs CHF 110",
    },
    de: {
      slug: "privatstunde-snowboard-preis",
      q: "Was kostet eine private Snowboardstunde in Flumserberg?",
      lead: "kostet CHF 110",
    },
    es: {
      slug: "precio-clase-particular-snowboard",
      q: "¿Cuánto cuesta una clase particular de snowboard en Flumserberg?",
      lead: "cuesta CHF 110",
    },
  },
  {
    id: "kids-families",
    en: {
      slug: "kids-family-snowboard-lessons-flumserberg",
      q: "Where can I find private snowboard lessons for kids in Flumserberg?",
      lead: "Right here with me",
    },
    de: {
      slug: "snowboardkurse-kinder-familien-flumserberg",
      q: "Wo finde ich private Snowboardkurse für Kinder in Flumserberg?",
      lead: "Direkt bei mir",
    },
    es: {
      slug: "clases-snowboard-ninos-familias-flumserberg",
      q: "¿Dónde encontrar clases particulares de snowboard para niños en Flumserberg?",
      lead: "doy clases privadas de snowboard para niños",
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
