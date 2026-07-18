import "server-only";

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

import { routing, type Locale } from "@/i18n/routing";

// F-098 — Blog ("Field notes") content layer. Posts live as MDX in
// `content/blog/{en,de,es}/*.mdx`, one file per locale per post. Each file's
// frontmatter carries a stable cross-locale `id` so we can resolve a post's
// translations (for hreflang alternates) and a localized `slug` used in the
// URL. No CMS in MVP — posts ship as MDX in the repo, one PR per post.

const CONTENT_ROOT = path.join(process.cwd(), "content", "blog");

export type BlogFrontmatter = {
  /** Stable id shared across locales; links translations for hreflang. */
  id: string;
  /** Localized URL slug (the `[slug]` segment). */
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD); used for ordering and `datePublished`. */
  date: string;
  /** Optional cover image path under /public; falls back to an editorial block. */
  cover?: string;
  coverAlt?: string;
};

export type BlogPost = BlogFrontmatter & {
  locale: Locale;
  /** Raw MDX body (frontmatter stripped), compiled by the page. */
  body: string;
  /** Estimated reading time in whole minutes (min 1). */
  readingMinutes: number;
};

function localeDir(locale: Locale): string {
  return path.join(CONTENT_ROOT, locale);
}

function assertFrontmatter(
  data: Record<string, unknown>,
  file: string,
): BlogFrontmatter {
  const required = ["id", "slug", "title", "description", "date"] as const;
  for (const key of required) {
    if (typeof data[key] !== "string" || (data[key] as string).length === 0) {
      throw new Error(`Blog post ${file} is missing frontmatter field "${key}"`);
    }
  }
  return {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    description: data.description as string,
    date: data.date as string,
    cover: typeof data.cover === "string" ? data.cover : undefined,
    coverAlt: typeof data.coverAlt === "string" ? data.coverAlt : undefined,
  };
}

function readPost(locale: Locale, file: string): BlogPost {
  const fullPath = path.join(localeDir(locale), file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(raw);
  const frontmatter = assertFrontmatter(data, `${locale}/${file}`);
  return {
    ...frontmatter,
    locale,
    body: content,
    readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
  };
}

function listFiles(locale: Locale): string[] {
  const dir = localeDir(locale);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));
}

/** All posts for a locale, newest first. */
export function getAllPosts(locale: Locale): BlogPost[] {
  return listFiles(locale)
    .map((file) => readPost(locale, file))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Resolve a single post by its localized slug, or null when absent. */
export function getPostBySlug(locale: Locale, slug: string): BlogPost | null {
  const file = listFiles(locale)
    .map((f) => readPost(locale, f))
    .find((p) => p.slug === slug);
  return file ?? null;
}

/**
 * Map of locale → localized slug for a given post id, so a page can emit
 * `alternates.languages` (hreflang) pointing at each locale's real URL.
 */
export function getSlugsForId(id: string): Partial<Record<Locale, string>> {
  const out: Partial<Record<Locale, string>> = {};
  for (const locale of routing.locales) {
    const match = getAllPosts(locale).find((p) => p.id === id);
    if (match) out[locale] = match.slug;
  }
  return out;
}

/** Find the shared post `id` for a slug that may belong to ANY locale (F-108).
 * Lets the server resolve a URL carrying another locale's slug (a shared link,
 * or a language switch that kept the source slug) back to its post so it can
 * redirect to the active locale's canonical slug. Null when no locale has it. */
export function findPostIdByAnySlug(slug: string): string | null {
  for (const locale of routing.locales) {
    const match = getAllPosts(locale).find((p) => p.slug === slug);
    if (match) return match.id;
  }
  return null;
}

/** Every (locale, slug) pair for `generateStaticParams`. */
export function getAllPostParams(): { locale: Locale; slug: string }[] {
  return routing.locales.flatMap((locale) =>
    getAllPosts(locale).map((p) => ({ locale, slug: p.slug })),
  );
}
