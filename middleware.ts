import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { canonicalRedirectTarget } from "./lib/seo/canonical-host";
import { parseAttribution } from "./lib/attribution/parse";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  encodeAttribution,
} from "./lib/attribution/cookie";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // F-114: 308 the production *.vercel.app alias to the canonical domain before
  // any locale handling (previews and the canonical host pass through). The
  // redirect preserves the query string, so a `?c=`/utm tag survives to the
  // canonical host, where this middleware runs again and sets the cookie below.
  const canonical = canonicalRedirectTarget({
    host: request.headers.get("host") ?? "",
    vercelEnv: process.env.VERCEL_ENV,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  if (canonical) return NextResponse.redirect(canonical, 308);

  const response = intlMiddleware(request);

  // F-156: first-touch marketing attribution. Setting a cookie on the response
  // at the edge does NOT un-static the page (the cookie is never read from a
  // shared layout — F-124), so the marketing tree stays cacheable. First touch
  // wins: skip entirely once the cookie exists so a later visit under a new tag
  // does not overwrite the campaign that first brought the visitor in.
  if (!request.cookies.has(ATTRIBUTION_COOKIE)) {
    const attribution = parseAttribution(request.nextUrl.searchParams);
    if (attribution) {
      response.cookies.set({
        name: ATTRIBUTION_COOKIE,
        value: encodeAttribution(attribution),
        maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  return response;
}

export const config = {
  // Match everything except:
  // - /api/*                  (better-auth catch-all + sentry api + future API routes)
  // - /_next/*                (Next internals + static asset pipeline)
  // - /monitoring             (Sentry tunnelRoute from F-006)
  // - /sentry-example-page    (Sentry verification page, deletable later)
  // - /instructor/*, /admin/* (EN-only operator areas outside [locale], F-071+).
  //   Excluded so next-intl does not rewrite them to /en/instructor — they are
  //   served directly from app/instructor and app/admin, not under [locale].
  // - any path with a dot     (favicon.ico, vercel.svg, robots.txt, etc.)
  matcher: [
    "/((?!api|_next|monitoring|sentry-example-page|instructor|admin|.*\\..*).*)",
  ],
};
