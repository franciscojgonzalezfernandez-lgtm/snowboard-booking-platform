import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getLocale } from "next-intl/server";
import "./globals.css";

import { siteOrigin } from "@/lib/seo/site-url";

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

export const metadata: Metadata = {
  // Resolves relative og:image / canonical / hreflang URLs to absolute ones.
  // Without it Next falls back to localhost and social cards break in prod.
  metadataBase: new URL(siteOrigin()),
  title: "Snowboard Booking Platform",
  description: "Private snowboard lessons in Switzerland — booking platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // WCAG 3.1.1: the <html lang> must match the page language. The tag lives in
  // the root layout (outside [locale]), so read the active locale from next-intl
  // (falls back to the default for the EN-only /admin and /instructor trees).
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${archivo.variable} ${archivoBlack.variable} antialiased`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
