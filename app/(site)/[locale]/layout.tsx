import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { SiteFooter } from "@/app/components/SiteFooter";
import {
  RootAnalytics,
  rootBodyClassName,
  rootMetadata,
} from "@/app/root-shell";
import "@/app/globals.css";

// Root layout for the trilingual public surface (F-124). It owns `<html>` /
// `<body>` so `lang` comes straight from the route segment and every page under
// it can prerender. The EN-only operator panels have their own root layout in
// `app/(ops)`.

export const metadata = rootMetadata;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    // WCAG 3.1.1: the lang matches the page language, and because it comes from
    // the static param it costs no dynamic read of the request.
    <html lang={locale}>
      <body className={rootBodyClassName}>
        <NextIntlClientProvider messages={messages}>
          <div className="flex min-h-dvh flex-col">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
        <RootAnalytics />
      </body>
    </html>
  );
}
