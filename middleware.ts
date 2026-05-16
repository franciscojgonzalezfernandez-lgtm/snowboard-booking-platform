import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match everything except:
  // - /api/*                  (better-auth catch-all + sentry api + future API routes)
  // - /_next/*                (Next internals + static asset pipeline)
  // - /monitoring             (Sentry tunnelRoute from F-006)
  // - /sentry-example-page    (Sentry verification page, deletable later)
  // - any path with a dot     (favicon.ico, vercel.svg, robots.txt, etc.)
  matcher: [
    "/((?!api|_next|monitoring|sentry-example-page|.*\\..*).*)",
  ],
};
