import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import {
  getInstructorBySlug,
  listActiveInstructors,
} from "@/lib/instructor/public-profiles";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og-template";

// Per-instructor share card: the rider's name as the headline. Highest-value
// social surface (people share the profile they want to book).
export const runtime = "nodejs";
export const alt = "Snowboard instructor at The Drop";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams() {
  const instructors = await listActiveInstructors();
  return routing.locales.flatMap((locale) =>
    instructors.map((i) => ({ locale, slug: i.slug })),
  );
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function InstructorProfileOgImage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "instructors" });
  const instructor = await getInstructorBySlug(slug);
  return renderOgImage({
    kicker: t("eyebrow"),
    // Fall back to the index headline if the slug 404s (card still renders).
    title: instructor?.name ?? t("heading"),
  });
}
