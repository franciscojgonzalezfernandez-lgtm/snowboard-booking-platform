import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { canonicalRedirectTarget } from "./lib/seo/canonical-host";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // F-114: 308 the production *.vercel.app alias to the canonical domain before
  // any locale handling (previews and the canonical host pass through).
  const canonical = canonicalRedirectTarget({
    host: request.headers.get("host") ?? "",
    vercelEnv: process.env.VERCEL_ENV,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  if (canonical) return NextResponse.redirect(canonical, 308);

  return intlMiddleware(request);
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
