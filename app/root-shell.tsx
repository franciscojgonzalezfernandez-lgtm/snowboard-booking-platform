import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { siteOrigin } from "@/lib/seo/site-url";

// Shared root-layout shell (F-124).
//
// The app has TWO root layouts — `(site)/[locale]` for the trilingual public
// surface and `(ops)` for the EN-only admin/instructor panels — because the
// `<html lang>` has to be statically known per locale (WCAG 3.1.1). A single
// root layout above `[locale]` could only get the locale by reading the request,
// and that one call marked every route in the app dynamic: `no-store`, a
// permanent CDN miss, ~45% of the home's LCP. Everything both roots need lives
// here so they cannot drift.

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

/** Font variables + base typography classes for the shared `<body>`. */
export const rootBodyClassName = `${archivo.variable} ${archivoBlack.variable} antialiased`;

export const rootMetadata: Metadata = {
  // Resolves relative og:image / canonical / hreflang URLs to absolute ones.
  // Without it Next falls back to localhost and social cards break in prod.
  metadataBase: new URL(siteOrigin()),
  title: "Snowboard Booking Platform",
  description: "Private snowboard lessons in Switzerland — booking platform",
};

/** Analytics + Web Vitals beacons, mounted once per root layout. */
export function RootAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
