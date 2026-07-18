import { SITE_URL } from "@/lib/seo/site-url";

// F-114 — the production deployment is reachable both at the canonical domain
// (rideflumserberg.ch) and at its Vercel system alias
// (snowboard-booking-platform.vercel.app), which serves a full duplicate of the
// site. This computes a 308 target to the canonical domain for requests hitting
// any `*.vercel.app` host on the PRODUCTION deployment, preserving path + query.
//
// Preview deployments (every PR) legitimately live on `*.vercel.app` with
// `VERCEL_ENV === 'preview'`, so they are never redirected — otherwise previews
// would bounce to prod. Local dev (`VERCEL_ENV` undefined) is likewise exempt.
//
// Pure (host/env/path in → URL or null out) so it unit-tests without a
// NextRequest; the middleware turns a non-null result into `NextResponse.redirect`.
export function canonicalRedirectTarget(input: {
  host: string;
  vercelEnv: string | undefined;
  pathname: string;
  search: string;
}): string | null {
  const { host, vercelEnv, pathname, search } = input;
  if (vercelEnv !== "production") return null;
  // Canonical host (and anything not a vercel.app alias) passes through.
  if (!host.endsWith(".vercel.app")) return null;
  return `${SITE_URL}${pathname}${search}`;
}
