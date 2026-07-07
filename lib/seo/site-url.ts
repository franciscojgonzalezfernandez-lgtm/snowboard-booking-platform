// Canonical public origin for absolute URLs in metadata (og:image, canonical,
// hreflang alternates). Mirrors `appBaseUrl()` (lib/calendar/google-oauth.ts)
// but without the `server-only` guard so it can be used in metadata/sitemap.
// Prod sets BETTER_AUTH_URL = https://rideflumserberg.ch.
export function siteOrigin(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}
// Canonical production origin, used to build absolute URLs for metadata
// (canonical + hreflang alternates). Kept as a single source so SEO surfaces
// (F-098 blog, later F-099 sitemap / F-100 structured data) agree on the host.
export const SITE_URL = "https://rideflumserberg.ch";
