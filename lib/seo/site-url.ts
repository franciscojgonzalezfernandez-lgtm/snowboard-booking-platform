// Canonical public origin for absolute URLs in metadata (og:image, canonical,
// hreflang alternates). Mirrors `appBaseUrl()` (lib/calendar/google-oauth.ts)
// but without the `server-only` guard so it can be used in metadata/sitemap.
// Prod sets BETTER_AUTH_URL = https://rideflumserberg.ch.
export function siteOrigin(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}
