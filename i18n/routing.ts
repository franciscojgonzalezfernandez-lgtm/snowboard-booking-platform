import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "de", "es"],
  defaultLocale: "en",
  // English slugs for now (e.g. /en/login, /de/login, /es/login).
  // Translated slugs (`/es/iniciar-sesion`, `/de/anmelden`) come in Sprint 5
  // via `pathnames` config — keeping it minimal here.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
