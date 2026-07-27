import type { Metadata } from "next";

import { routing, type Locale } from "@/i18n/routing";
import { BUSINESS } from "@/lib/seo/business";
import { hreflangAlternates, type InternalHref } from "@/lib/seo/hreflang";

// Canonical + hreflang alternates for a marketing route (F-103), derived from
// the same F-102 `pathnames` map as the F-099 sitemap — one source of truth, so
// page metadata and the sitemap can never disagree. Spread into a page's
// generateMetadata:  `alternates: marketingAlternates("/faq", locale)`.
//
// The canonical is SELF-referential (the current locale's URL) — a DE page
// canonicalises to its own /de URL, not to EN. `x-default` in the languages map
// still points at the default (EN) locale. OG/Twitter images stay file-based
// (F-101 opengraph-image.tsx / twitter-image.tsx); this only owns canonical +
// language alternates.
export function marketingAlternates(
  href: InternalHref,
  locale: string,
  params?: Record<string, string>,
): Metadata["alternates"] {
  const { languages } = hreflangAlternates(href, params);
  return { canonical: languages[locale as Locale], languages };
}

/** The brand name for `og:site_name`, sourced from the same identity constant
 * the Schema.org LocalBusiness uses (F-100) so social cards and structured data
 * can't disagree on the name. */
export const SITE_NAME = BUSINESS.name;

// Open Graph base for a marketing route (F-120). The HTML already emitted
// og:title/description (inherited from `title`/`description`) and og:image (the
// file-based opengraph-image.tsx, F-101), but Ahrefs flagged the missing
// og:url/og:type/og:site_name/og:locale on all 39 marketing URLs. This fills
// exactly those. Spread it next to the alternates:
//   openGraph: marketingOpenGraph("/precios", locale)
//
// `og:url` is SELF-referential (the current locale's canonical URL), matching
// the F-103 canonical. `og:type` is always "website" for marketing (blog posts
// build their own "article" OG in the post page). og:image is intentionally
// left to the opengraph-image.tsx convention — do not set it here or it double-
// emits.
export function marketingOpenGraph(
  href: InternalHref,
  locale: string,
  params?: Record<string, string>,
): Metadata["openGraph"] {
  const { languages } = hreflangAlternates(href, params);
  return {
    type: "website",
    siteName: SITE_NAME,
    url: languages[locale as Locale],
    locale,
    alternateLocale: routing.locales.filter((l) => l !== locale),
  };
}

// Open Graph base for a blog post (F-120). Blog posts don't live in the F-102
// `pathnames` map — their slug is localized content (frontmatter, F-098) — so
// they can't use `marketingOpenGraph`. This carries the same og:site_name and
// self-referential og:url contract but with `type: "article"` + `publishedTime`.
// The caller spreads in per-post `title`/`description`; og:image stays with the
// post's opengraph-image.tsx (F-109). `alternateLocales` should be the locales
// the post is actually translated into — never one that would 404.
export function articleOpenGraph(opts: {
  url: string;
  locale: string;
  publishedTime: string;
  alternateLocales: readonly string[];
}): Metadata["openGraph"] {
  return {
    type: "article",
    siteName: SITE_NAME,
    url: opts.url,
    locale: opts.locale,
    publishedTime: opts.publishedTime,
    alternateLocale: [...opts.alternateLocales],
  };
}
