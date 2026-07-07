import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listActiveInstructors } from "@/lib/instructor/public-profiles";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "instructors" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
  };
}

/** Humanize an unknown specialty slug ("ice-driving" → "Ice driving") so a new
 * seed value renders cleanly without a forced i18n key. */
function humanize(slug: string): string {
  const s = slug.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function InstructorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "instructors" });
  const instructors = await listActiveInstructors();

  const specialtyLabel = (slug: string) =>
    t.has(`specialty.${slug}`) ? t(`specialty.${slug}`) : humanize(slug);

  return (
    <main
      data-testid="instructors-page"
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

      <ul
        data-testid="instructor-grid"
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8"
      >
        {instructors.map((instructor) => (
          <li
            key={instructor.id}
            className="border border-foreground/15 bg-background transition-colors hover:border-foreground/30"
          >
            <Link
              href={{
                pathname: "/instructores/[slug]",
                params: { slug: instructor.slug },
              }}
              data-testid="instructor-card"
              className="group flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-foreground/5">
                {instructor.photo ? (
                  <Image
                    src={instructor.photo}
                    alt={instructor.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-full items-center justify-center font-display text-7xl text-foreground/20"
                  >
                    {instructor.name.charAt(0)}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-4 p-6">
                <h2 className="font-display text-2xl tracking-tight">
                  {instructor.name}
                </h2>

                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {instructor.languages
                    .map((code) => t(`lang.${code}`))
                    .join(" · ")}
                </p>

                <ul className="flex flex-wrap gap-2">
                  {instructor.specialties.map((slug) => (
                    <li
                      key={slug}
                      className="rounded-full border border-foreground/20 px-3 py-1 text-xs tracking-wide text-foreground/70"
                    >
                      {specialtyLabel(slug)}
                    </li>
                  ))}
                </ul>

                <span className="mt-auto pt-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  {t("view_profile")} →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
