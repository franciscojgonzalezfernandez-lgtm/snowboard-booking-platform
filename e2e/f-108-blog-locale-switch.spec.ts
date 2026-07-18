import { test, expect } from "@playwright/test";

// F-108 — switching locale on a blog post must land on that locale's translated
// slug (the slug is localized content, not a static pathname), never 404.
// Slugs are the launch-post frontmatter (content/blog/<locale>/*.mdx), keyed by
// the shared `id`.
const POSTS = [
  {
    id: "first-day",
    en: "your-first-day-on-a-snowboard",
    de: "dein-erster-tag-auf-dem-snowboard",
    es: "tu-primer-dia-en-snowboard",
  },
  {
    id: "freestyle-vs-carving",
    en: "freestyle-or-carving-which-lesson",
    de: "freestyle-oder-carving-welcher-kurs",
    es: "freestyle-o-carving-que-clase-elegir",
  },
  {
    id: "why-flumserberg",
    en: "why-learn-snowboarding-flumserberg",
    de: "warum-snowboarden-lernen-flumserberg",
    es: "por-que-aprender-snowboard-flumserberg",
  },
] as const;

test.describe("F-108 — blog language switch keeps the post", () => {
  for (const post of POSTS) {
    test(`switch EN→DE→ES on "${post.id}" follows the translated slug`, async ({
      page,
    }) => {
      await page.goto(`/en/blog/${post.en}`);
      await expect(page.getByTestId("blog-post")).toHaveAttribute(
        "data-post-id",
        post.id,
      );

      await page.getByTestId("lang-de").click();
      await page.waitForURL(`**/de/blog/${post.de}`);
      await expect(page.getByTestId("blog-post")).toHaveAttribute(
        "data-post-id",
        post.id,
      );

      await page.getByTestId("lang-es").click();
      await page.waitForURL(`**/es/blog/${post.es}`);
      await expect(page.getByTestId("blog-post")).toHaveAttribute(
        "data-post-id",
        post.id,
      );
    });
  }

  test("server redirects a wrong-locale slug to the canonical one", async ({
    page,
  }) => {
    const post = POSTS[1];
    // Land on /de carrying the EN slug (a shared link, or the old switcher).
    await page.goto(`/de/blog/${post.en}`);
    await page.waitForURL(`**/de/blog/${post.de}`);
    await expect(page.getByTestId("blog-post")).toHaveAttribute(
      "data-post-id",
      post.id,
    );
  });

  test("a slug that exists in no locale still 404s", async ({ page }) => {
    const res = await page.goto("/en/blog/definitely-not-a-real-post");
    expect(res?.status()).toBe(404);
  });

  test("regression (F-102): the pricing switcher still translates the slug", async ({
    page,
  }) => {
    await page.goto("/en/pricing");
    await page.getByTestId("lang-de").click();
    await page.waitForURL("**/de/preise");
  });
});
