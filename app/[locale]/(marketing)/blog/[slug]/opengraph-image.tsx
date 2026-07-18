import { getTranslations } from "next-intl/server";

import { type Locale } from "@/i18n/routing";
import { getAllPostParams, getPostBySlug } from "@/lib/blog/posts";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og-template";

// Per-post share card: the post title as the headline, "Field notes" kicker.
// F-098 (blog) landed in parallel with F-101 (which only covered the static
// marketing routes), so a shared post otherwise renders without an image.
export const runtime = "nodejs";
export const alt = "Field notes — Ride Flumserberg";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getAllPostParams();
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function BlogPostOgImage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const post = getPostBySlug(locale as Locale, slug);
  return renderOgImage({
    kicker: t("eyebrow"),
    // Fall back to the blog index headline when the slug 404s, so the card
    // still renders instead of crashing the route.
    title: post?.title ?? t("heading"),
  });
}
