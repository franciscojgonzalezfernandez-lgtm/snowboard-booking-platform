import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "de", "es"],
  defaultLocale: "en",
  // Locale prefix stays on every locale (incl. EN) for now. Dropping the EN
  // prefix is deferred: it would force every hand-built `/${locale}/…` path in
  // the booking funnel, auth redirects and transactional emails through
  // next-intl's `getPathname`, which is out of scope for F-102.
  localePrefix: "always",
  // F-102 — translated slugs for the public **marketing** pages (local SEO:
  // `/de/preise`, `/es/precios` rank better per market than a shared EN slug).
  //
  // Keys are the *internal* pathnames (they match the file-system routes under
  // `app/[locale]/…`); values are the *external* slugs next-intl rewrites to.
  // Internal links keep using the typed `Link`/`redirect` helpers with the key
  // (e.g. `href="/sobre"`) and next-intl emits the active locale's slug.
  //
  // Payment/auth/legal routes (`/reservar*`, `/login`, `/dashboard`, `/terms`,
  // `/privacy`) deliberately keep an identical slug across locales: server-side
  // `redirect()`s, the Stripe return URL and the emails build those paths as raw
  // `/${locale}/…` strings, so translating them would 404 without a broader
  // refactor. They are still listed here because once `pathnames` is set the
  // typed navigation is strict — every linked pathname must be a declared key.
  // `/faq` keeps the universal token (recognised abbreviation in DE/ES).
  pathnames: {
    "/": "/",
    "/precios": { en: "/pricing", de: "/preise", es: "/precios" },
    "/instructores": {
      en: "/instructors",
      de: "/instruktoren",
      es: "/instructores",
    },
    "/instructores/[slug]": {
      en: "/instructors/[slug]",
      de: "/instruktoren/[slug]",
      es: "/instructores/[slug]",
    },
    "/sobre": { en: "/about", de: "/ueber-uns", es: "/sobre" },
    "/contacto": { en: "/contact", de: "/kontakt", es: "/contacto" },
    "/plan-your-visit": {
      en: "/plan-your-visit",
      de: "/plane-deinen-besuch",
      es: "/planea-tu-visita",
    },
    "/faq": "/faq",
    // Blog (F-098): the `/blog` index segment stays universal (recognised
    // loanword in DE/ES, like `/faq`); the post slug itself is already
    // localised per locale in `content/blog/{en,de,es}/…`.
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/terms": "/terms",
    "/privacy": "/privacy",
    "/login": "/login",
    "/dashboard": "/dashboard",
    "/reservar": "/reservar",
    "/reservar/pago/[bookingId]": "/reservar/pago/[bookingId]",
    "/reservar/exito/[id]": "/reservar/exito/[id]",
  },
});

export type Locale = (typeof routing.locales)[number];
