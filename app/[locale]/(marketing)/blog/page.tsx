import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { marketingAlternates } from "@/lib/seo/page-metadata";

import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { formatBlogDate } from "@/lib/blog/format";
import { getAllPosts } from "@/lib/blog/posts";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
    alternates: marketingAlternates("/blog", locale),
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const t = await getTranslations({ locale, namespace: "blog" });
  const posts = getAllPosts(typedLocale);

  return (
    <main
      data-testid="blog-page"
      className="mx-auto max-w-[1320px] px-6 py-16 sm:py-24 lg:px-7"
    >
      <header className="mb-14 max-w-2xl space-y-5">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-6xl">
          {t("heading")}
        </h1>
        <p className="text-lg leading-relaxed text-foreground/80">
          {t("intro")}
        </p>
      </header>

      {posts.length === 0 ? (
        <p
          data-testid="blog-empty"
          className="text-lg leading-relaxed text-foreground/70"
        >
          {t("empty")}
        </p>
      ) : (
        <ul
          data-testid="blog-grid"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8"
        >
          {posts.map((post) => (
            <li
              key={post.id}
              className="border border-foreground/15 bg-background transition-colors hover:border-foreground/30"
            >
              <Link
                href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }}
                data-testid="blog-card"
                className="group flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-[3/2] overflow-hidden bg-foreground/5">
                  {post.cover ? (
                    <Image
                      src={post.cover}
                      alt={post.coverAlt ?? ""}
                      fill
                      sizes="(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-display text-2xl uppercase tracking-tight text-foreground/15">
                        Ride Flumserberg
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    <time dateTime={post.date}>
                      {formatBlogDate(post.date, typedLocale)}
                    </time>
                    <span aria-hidden> · </span>
                    {t("read_time", { minutes: post.readingMinutes })}
                  </p>
                  <h2 className="mt-4 font-display text-2xl leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-foreground/70">
                    {post.description}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
