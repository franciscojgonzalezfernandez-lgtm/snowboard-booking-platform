import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Reveal } from "@/lib/motion/reveal";
import { marketingAlternates } from "@/lib/seo/page-metadata";
import { prisma } from "@/lib/db";
import { seasonStatus } from "@/lib/season/plan-status";
import { MEETING_POINT_LABEL } from "@/lib/contact/location";
import {
  RESORT_OPERATING_HOURS_URL,
  RESORT_URL,
} from "@/lib/content/plan-your-visit";

type Props = { params: Promise<{ locale: string }> };

// Reads the active Season (season block is live, not hardcoded), so this is ISR
// rather than pure SSG — revalidate hourly like /precios and the sitemap.
export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// BCP-47 tags for date formatting (mirrors the de-CH currency convention).
const DATE_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  de: "de-CH",
  es: "es-ES",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "planVisit" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
    alternates: marketingAlternates("/plan-your-visit", locale),
  };
}

export default async function PlanYourVisitPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "planVisit" });

  const season = await prisma.season.findFirst({
    where: { active: true },
    orderBy: { startDate: "asc" },
    select: { startDate: true, endDate: true },
  });
  const status = seasonStatus(season, new Date());

  // Dates are `@db.Date` (UTC midnight) — format in UTC to avoid an off-by-one.
  const fmt = (date: Date) =>
    new Intl.DateTimeFormat(DATE_LOCALE[locale as Locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

  const seasonLine =
    status.kind === "active"
      ? t("season_active", { date: fmt(status.endDate) })
      : status.kind === "upcoming"
        ? t("season_upcoming", {
            start: fmt(status.startDate),
            end: fmt(status.endDate),
          })
        : t("season_none");

  return (
    <main
      data-testid="plan-your-visit-page"
      className="mx-auto max-w-[900px] px-7 py-16 sm:py-24"
    >
      <Reveal>
        <header className="mb-16 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-4 text-[12px] font-bold uppercase tracking-[0.28em]">
            <span className="block h-[2px] w-12 bg-primary" aria-hidden></span>
            <span>{t("eyebrow")}</span>
          </div>
          <h1 className="font-display text-[clamp(34px,6vw,68px)] leading-[0.95] tracking-[-0.02em]">
            {t("heading")}
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-foreground/80">
            {t("lede")}
          </p>
        </header>
      </Reveal>

      <div className="space-y-14">
        {/* Season — live from the active Season row. */}
        <Reveal>
          <section className="border-t-2 border-foreground pt-8">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("season_title")}
            </h2>
            <p
              data-testid="plan-season-status"
              className="mt-4 max-w-[62ch] text-lg leading-relaxed text-foreground/80"
            >
              {seasonLine}
            </p>
            <Link
              href="/precios"
              className="mt-5 inline-block text-[13px] font-bold uppercase tracking-[0.18em] text-primary underline decoration-2 underline-offset-4"
            >
              {t("season_cta")}
            </Link>
          </section>
        </Reveal>

        {/* Getting here — reuses the shared meeting-point label; map lives on /contacto. */}
        <Reveal>
          <section className="border-t border-foreground/15 pt-8">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("getting_title")}
            </h2>
            <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-foreground/80">
              {t("getting_body", { meeting: MEETING_POINT_LABEL })}
            </p>
            <Link
              href="/contacto"
              data-testid="plan-map-cta"
              className="mt-5 inline-block text-[13px] font-bold uppercase tracking-[0.18em] text-primary underline decoration-2 underline-offset-4"
            >
              {t("getting_map_cta")}
            </Link>
          </section>
        </Reveal>

        {/* Gear rental — resort's own rental (no invented third-party shops). */}
        <Reveal>
          <section className="border-t border-foreground/15 pt-8">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("rental_title")}
            </h2>
            <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-foreground/80">
              {t("rental_body")}
            </p>
            <a
              href={RESORT_URL}
              target="_blank"
              rel="noopener"
              data-testid="plan-rental-link"
              className="mt-5 inline-block text-[13px] font-bold uppercase tracking-[0.18em] text-primary underline decoration-2 underline-offset-4"
            >
              {t("rental_cta")}
            </a>
          </section>
        </Reveal>

        {/* On the mountain — general, verifiable area info. */}
        <Reveal>
          <section className="border-t border-foreground/15 pt-8">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("area_title")}
            </h2>
            <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-foreground/80">
              {t("area_body")}
            </p>
          </section>
        </Reveal>

        {/* Lift & resort hours — link to the resort's canonical page, never mirror. */}
        <Reveal>
          <section className="border-t border-foreground/15 pt-8">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              {t("hours_title")}
            </h2>
            <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-foreground/80">
              {t("hours_body")}
            </p>
            <a
              href={RESORT_OPERATING_HOURS_URL}
              target="_blank"
              rel="noopener"
              data-testid="plan-hours-link"
              className="mt-5 inline-block text-[13px] font-bold uppercase tracking-[0.18em] text-primary underline decoration-2 underline-offset-4"
            >
              {t("hours_cta")}
            </a>
          </section>
        </Reveal>

        {/* CTA */}
        <Reveal>
          <section className="border-t-2 border-foreground pt-10">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              {t("cta_title")}
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/reservar"
                className="rounded-md border-2 border-primary bg-primary px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-destructive hover:border-destructive"
              >
                {t("cta_book")}
              </Link>
              <Link
                href="/contacto"
                className="rounded-md border-2 border-foreground bg-transparent px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                {t("cta_contact")}
              </Link>
            </div>
          </section>
        </Reveal>
      </div>
    </main>
  );
}
