import { routing, type Locale } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo/site-url";

// hreflang / canonical URL builder for the public marketing routes. Reads the
// SAME F-102 `pathnames` map that next-intl uses to route (`i18n/routing.ts`),
// so the sitemap (F-099) and per-page metadata (F-103) can never drift from the
// actual URLs. Pure (config + constant only) — no next-intl runtime, no DB — so
// it unit-tests without a request context.
//
// `localePrefix: "always"` (F-102): every locale carries its prefix, including
// EN (`/en/...`). Dropping the EN prefix was deferred, so the AC line "EN sin
// prefijo" is stale — every emitted URL is prefixed.

/** Internal route keys declared in the `pathnames` map. */
export type InternalHref = keyof typeof routing.pathnames;

/** Resolve the external, locale-specific path for an internal route key.
 * Substitutes dynamic `[param]` segments. `"/"` collapses to just the locale
 * prefix (no trailing slash). */
export function localizedPath(
  href: InternalHref,
  locale: Locale,
  params?: Record<string, string>,
): string {
  const entry = routing.pathnames[href] as string | Record<Locale, string>;
  let segment = typeof entry === "string" ? entry : entry[locale];
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      segment = segment.replace(`[${key}]`, value);
    }
  }
  const path = segment === "/" ? "" : segment;
  return `/${locale}${path}`;
}

/** Absolute canonical URL (default locale) plus the full hreflang `languages`
 * map for a route, including `x-default` → the default locale. Shape matches
 * what both `MetadataRoute.Sitemap` `alternates.languages` and Next's
 * `alternates` metadata expect. */
export function hreflangAlternates(
  href: InternalHref,
  params?: Record<string, string>,
): { canonical: string; languages: Record<Locale, string> & { "x-default": string } } {
  const languages = {} as Record<Locale, string> & { "x-default": string };
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}${localizedPath(href, locale, params)}`;
  }
  const canonical = `${SITE_URL}${localizedPath(href, routing.defaultLocale, params)}`;
  languages["x-default"] = canonical;
  return { canonical, languages };
}
