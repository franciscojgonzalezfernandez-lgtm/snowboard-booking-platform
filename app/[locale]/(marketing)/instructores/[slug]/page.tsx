import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  getInstructorBySlug,
  listActiveInstructors,
} from "@/lib/instructor/public-profiles";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const instructors = await listActiveInstructors();
  return routing.locales.flatMap((locale) =>
    instructors.map((i) => ({ locale, slug: i.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const instructor = await getInstructorBySlug(slug);
  const t = await getTranslations({ locale, namespace: "instructors" });
  if (!instructor) {
    return { title: t("metadata_title") };
  }
  return {
    title: t("profile_metadata_title", { name: instructor.name }),
    description: t("profile_metadata_description", { name: instructor.name }),
  };
}

function humanize(slug: string): string {
  const s = slug.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function InstructorProfilePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const instructor = await getInstructorBySlug(slug);
  if (!instructor) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "instructors" });
  const tPricing = await getTranslations({ locale, namespace: "pricing" });
  const specialtyLabel = (s: string) =>
    t.has(`specialty.${s}`) ? t(`specialty.${s}`) : humanize(s);

  const classKickers = [
    "oneHour",
    "twoHours",
    "intensive",
    "fullDay",
  ] as const;

  return (
    <main
      data-testid="instructor-profile"
      className="mx-auto max-w-[1100px] px-6 py-16 sm:py-24 lg:px-7"
    >
      <Link
        href="/instructores"
        className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
      >
        ← {t("back")}
      </Link>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
        <div className="relative aspect-[4/5] overflow-hidden border border-foreground/15 bg-foreground/5">
          {instructor.photo ? (
            <Image
              src={instructor.photo}
              alt={instructor.name}
              fill
              sizes="(min-width: 1024px) 420px, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full items-center justify-center font-display text-8xl text-foreground/20"
            >
              {instructor.name.charAt(0)}
            </span>
          )}
        </div>

        <div className="space-y-10">
          <header className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {t("eyebrow")}
            </p>
            <h1
              data-testid="instructor-name"
              className="font-display text-4xl tracking-tight sm:text-6xl"
            >
              {instructor.name}
            </h1>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-foreground/70">
              {instructor.languages
                .map((code) => t(`lang.${code}`))
                .join(" · ")}
            </p>
          </header>

          {instructor.bio ? (
            <p className="max-w-prose text-lg leading-relaxed text-foreground/85">
              {instructor.bio}
            </p>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("specialties_label")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {instructor.specialties.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-foreground/20 px-3 py-1 text-sm text-foreground/75"
                >
                  {specialtyLabel(s)}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("teaches_label")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {classKickers.map((key) => (
                <li
                  key={key}
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm text-foreground/80"
                >
                  {tPricing(`tier.${key}.kicker`)}
                </li>
              ))}
            </ul>
          </section>

          <Link
            href="/reservar"
            data-testid="instructor-cta"
            className="inline-flex rounded-md border-2 border-primary bg-primary px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:border-destructive hover:bg-destructive"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </main>
  );
}
