import type { MetadataRoute } from "next";

import { routing, type Locale } from "@/i18n/routing";
import { getAllPosts, getSlugsForId } from "@/lib/blog/posts";
import { listActiveInstructors } from "@/lib/instructor/public-profiles";
import { hreflangAlternates, type InternalHref } from "@/lib/seo/hreflang";
import { SITE_URL } from "@/lib/seo/site-url";

// Multilingual sitemap (F-099). Every public marketing page is emitted once
// PER LOCALE (Google wants a separate <url> for each language version), and
// each entry carries the full hreflang alternate set + x-default. Authenticated
// / funnel routes (dashboard, reservar, admin, instructor, api) are excluded —
// they live in robots.ts `disallow`.
//
// Revalidate hourly so newly published posts / activated instructors surface
// without a full redeploy (matches the /precios ISR window).
export const revalidate = 3600;

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

type StaticRoute = {
  href: InternalHref;
  priority: number;
  changeFrequency: ChangeFrequency;
};

// Indexable marketing routes only. Order roughly by SEO importance.
const STATIC_ROUTES: StaticRoute[] = [
  { href: "/", priority: 1.0, changeFrequency: "weekly" },
  { href: "/precios", priority: 0.9, changeFrequency: "weekly" },
  { href: "/instructores", priority: 0.8, changeFrequency: "monthly" },
  { href: "/contacto", priority: 0.7, changeFrequency: "monthly" },
  { href: "/plan-your-visit", priority: 0.7, changeFrequency: "monthly" },
  { href: "/sobre", priority: 0.6, changeFrequency: "monthly" },
  { href: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { href: "/blog", priority: 0.6, changeFrequency: "weekly" },
  { href: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { href: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

/** Blog uses localized content slugs (not the `pathnames` map); the `/blog`
 * segment itself is universal. Mirrors `postUrl` in blog/[slug]/page.tsx. */
function blogPostUrl(locale: Locale, slug: string): string {
  return `${SITE_URL}/${locale}/blog/${slug}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // 1) Static marketing routes — one <url> per locale, shared alternate set.
  for (const route of STATIC_ROUTES) {
    const { languages } = hreflangAlternates(route.href);
    for (const locale of routing.locales) {
      entries.push({
        url: languages[locale],
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages },
      });
    }
  }

  // 2) Instructor profiles. Slug is derived from the name → identical across
  //    locales; only the parent segment translates. lastmod from createdAt.
  const instructors = await listActiveInstructors();
  for (const instructor of instructors) {
    const { languages } = hreflangAlternates("/instructores/[slug]", {
      slug: instructor.slug,
    });
    for (const locale of routing.locales) {
      entries.push({
        url: languages[locale],
        lastModified: instructor.createdAt,
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: { languages },
      });
    }
  }

  // 3) Blog posts — grouped by the shared frontmatter `id`; one <url> per locale
  //    that actually has a translation, with reciprocal hreflang + x-default.
  const seenPostIds = new Set<string>();
  for (const locale of routing.locales) {
    for (const post of getAllPosts(locale)) {
      if (seenPostIds.has(post.id)) continue;
      seenPostIds.add(post.id);

      const slugs = getSlugsForId(post.id);
      const languages: Record<string, string> = {};
      for (const [loc, locSlug] of Object.entries(slugs)) {
        languages[loc] = blogPostUrl(loc as Locale, locSlug);
      }
      if (slugs.en) languages["x-default"] = blogPostUrl("en", slugs.en);

      const lastModified = new Date(post.date);
      for (const [loc, locSlug] of Object.entries(slugs)) {
        entries.push({
          url: blogPostUrl(loc as Locale, locSlug),
          lastModified,
          changeFrequency: "yearly",
          priority: 0.5,
          alternates: { languages },
        });
      }
    }
  }

  return entries;
}
