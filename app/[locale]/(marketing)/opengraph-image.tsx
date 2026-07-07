import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og-template";

// Home OG card. F-091 shipped a logo-only card; F-101 generalises it onto the
// shared template with the localized hero line.
export const runtime = "nodejs";
export const alt = "The Drop — Private snowboard lessons in Flumserberg";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export default async function HomeOgImage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return renderOgImage({
    kicker: t("eyebrow"),
    title: `${t("hero_title_1")} ${t("hero_title_2")} ${t("hero_accent")}`,
  });
}
