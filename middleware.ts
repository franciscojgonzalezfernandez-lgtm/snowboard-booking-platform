import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

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
