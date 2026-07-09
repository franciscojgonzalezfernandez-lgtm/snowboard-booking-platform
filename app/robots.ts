import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo/site-url";

// robots.txt (F-099). Public marketing is crawlable; authenticated and funnel
// surfaces are excluded. `localePrefix: "always"` means the student dashboard
// and booking funnel live under every locale prefix (/en/reservar, …), so those
// are disallowed per locale. The ops/instructor panels and the API live at the
// root (outside [locale]) and are disallowed once.
export default function robots(): MetadataRoute.Robots {
  const localePrivate = routing.locales.flatMap((locale) => [
    `/${locale}/dashboard`, // student area (F-047+)
    `/${locale}/reservar`, // booking funnel + /pago + /exito (parameterised → crawl-budget waste)
  ]);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", // ops panel (root, EN-only)
          "/instructor", // instructor panel (root) — NOT the /{locale}/instructores marketing pages
          "/api",
          "/sentry-example-page", // Sentry demo route, never for indexing
          ...localePrivate,
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
