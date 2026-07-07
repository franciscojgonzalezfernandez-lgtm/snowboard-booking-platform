// Canonical production origin, used to build absolute URLs for metadata
// (canonical + hreflang alternates). Kept as a single source so SEO surfaces
// (F-098 blog, later F-099 sitemap / F-100 structured data) agree on the host.
export const SITE_URL = "https://rideflumserberg.ch";

/**
 * Resolve a stored asset reference to an absolute URL. Paths beginning with a
 * scheme (e.g. a Vercel Blob upload) are returned untouched; site-relative
 * paths (e.g. "/content/first-day.png") are prefixed with {@link SITE_URL}.
 * Used by structured data / OG metadata where Schema.org requires absolute URLs
 * and the source may be either an uploaded Blob URL or a `/public` path.
 */
export function toAbsoluteUrl(pathOrUrl: string): string {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
}
