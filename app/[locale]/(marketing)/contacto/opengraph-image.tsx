import { routing } from "@/i18n/routing";
import { ogImageFromNamespace } from "@/lib/seo/og-route";
import { OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og-template";

export const runtime = "nodejs";
export const alt = "The Drop — get in touch";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export default async function ContactOgImage({ params }: Props) {
  const { locale } = await params;
  return ogImageFromNamespace(locale, "contact");
}
