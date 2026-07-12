import type { Metadata } from "next";

import type { Locale } from "@/i18n/routing";
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
