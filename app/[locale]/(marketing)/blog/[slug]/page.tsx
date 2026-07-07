import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";
import { formatBlogDate } from "@/lib/blog/format";
import { getAllPostParams, getPostBySlug, getSlugsForId } from "@/lib/blog/posts";
import { SITE_URL, toAbsoluteUrl } from "@/lib/seo/site-url";
import { JsonLd } from "@/app/components/JsonLd";
import { buildBlogPosting } from "@/lib/seo/structured-data";
import { blogMdxComponents } from "../mdx-components";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return getAllPostParams();
}

/** Absolute URL for a post in a given locale. `localePrefix: "always"` means
 * every locale carries its prefix, and the "blog" segment is not translated. */
function postUrl(locale: Locale, slug: string): string {
  return `${SITE_URL}/${locale}/blog/${slug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getPostBySlug(locale as Locale, slug);
  if (!post) {
    const t = await getTranslations({ locale, namespace: "blog" });
    return { title: t("metadata_title") };
  }

  // hreflang: one entry per locale that actually has this post, plus
  // x-default → the English version (master voice / default locale).
  const slugs = getSlugsForId(post.id);
  const languages: Record<string, string> = {};
  for (const [loc, locSlug] of Object.entries(slugs)) {
    languages[loc] = postUrl(loc as Locale, locSlug);
  }
  if (slugs.en) languages["x-default"] = postUrl("en", slugs.en);

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: postUrl(locale as Locale, post.slug),
      languages,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: postUrl(locale as Locale, post.slug),
      publishedTime: post.date,
      locale,
      images: post.cover ? [{ url: `${SITE_URL}${post.cover}` }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const post = getPostBySlug(typedLocale, slug);
  if (!post) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "blog" });
  const { content } = await compileMDX({
    source: post.body,
    components: blogMdxComponents,
    options: { parseFrontmatter: false },
  });

  const blogPostingJsonLd = buildBlogPosting({
    headline: post.title,
    description: post.description,
    url: postUrl(typedLocale, post.slug),
    datePublished: post.date,
    image: post.cover ? toAbsoluteUrl(post.cover) : null,
    inLanguage: typedLocale,
  });

  return (
    <main
      data-testid="blog-post"
      data-post-id={post.id}
      className="mx-auto max-w-[820px] px-6 py-16 sm:py-24 lg:px-7"
    >
      <JsonLd data={blogPostingJsonLd} />
      <Link
        href="/blog"
        className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
      >
        ← {t("back")}
      </Link>

      <header className="mt-8 space-y-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <time dateTime={post.date}>{formatBlogDate(post.date, typedLocale)}</time>
          <span aria-hidden> · </span>
          {t("read_time", { minutes: post.readingMinutes })}
        </p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        <p className="text-xl leading-relaxed text-foreground/70">
          {post.description}
        </p>
      </header>

      {post.cover ? (
        <div className="relative mt-10 aspect-[3/2] overflow-hidden bg-foreground/5">
          <Image
            src={post.cover}
            alt={post.coverAlt ?? ""}
            fill
            priority
            sizes="(min-width: 820px) 820px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <article className="mt-4">{content}</article>

      <footer className="mt-16 border-t-2 border-foreground pt-10">
        <p className="font-display text-2xl tracking-tight text-foreground">
          {t("cta_heading")}
        </p>
        <Link
          href="/reservar"
          data-testid="blog-cta"
          className="mt-6 inline-flex rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:border-primary hover:bg-primary"
        >
          {t("cta_button")}
        </Link>
      </footer>
    </main>
  );
}
