import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Duration } from "@prisma/client";

import { prisma } from "@/lib/db";
import { routing } from "@/i18n/routing";
import { formatChf } from "@/lib/pricing/format";
import { getPriceCents, PriceConfigurationError } from "@/lib/pricing/get-price";
import { Reveal } from "@/lib/motion/reveal";
import { PricingTiers, type PricingTier } from "./pricing-tiers";

type Props = { params: Promise<{ locale: string }> };

// Prices live in the DB (Season.priceCentsByDuration, F-080). ISR keeps the
// page static for SEO + the LCP budget while picking up owner price edits
// within the hour — no per-request DB hit on the hot path.
export const revalidate = 3600;

// Card order = the duration ladder shown to the rider (short → full day).
const DURATIONS: readonly Duration[] = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
];

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
  };
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pricing" });

  const season = await prisma.season.findFirst({
    where: { active: true },
    orderBy: { startDate: "asc" },
    select: { id: true, priceCentsByDuration: true },
  });

  // No active season, or a season with malformed/incomplete prices → honest
  // empty state rather than a half-filled grid (same contract as F-080).
  let tiers: PricingTier[] | null = null;
  if (season) {
    try {
      tiers = DURATIONS.map((duration) => ({
        duration,
        priceLabel: formatChf(getPriceCents(season, duration)),
      }));
    } catch (error) {
      if (!(error instanceof PriceConfigurationError)) throw error;
      tiers = null;
    }
  }

  return (
    <main data-testid="pricing-page" className="mx-auto max-w-[1320px] px-7 py-16 sm:py-24">
      <Reveal>
        <header className="mb-12 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-4 text-[12px] font-bold uppercase tracking-[0.28em]">
            <span className="block h-[2px] w-12 bg-primary" aria-hidden></span>
            <span>{t("eyebrow")}</span>
          </div>
          <h1 className="font-display text-[clamp(34px,6vw,68px)] leading-[0.95] tracking-[-0.02em]">
            {t("heading")}
          </h1>
          <p className="mt-6 text-lg leading-[1.5] text-foreground/80">{t("intro")}</p>
        </header>
      </Reveal>

      {tiers ? (
        <PricingTiers tiers={tiers} />
      ) : (
        <div
          data-testid="pricing-empty"
          className="border border-foreground/15 px-8 py-16 text-center"
        >
          <h2 className="font-display text-2xl tracking-tight">{t("empty.title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-foreground/75">{t("empty.body")}</p>
        </div>
      )}

      <Reveal>
        <section
          data-testid="pricing-included"
          className="mt-16 border-t border-foreground/15 pt-10"
        >
          <h2 className="font-display text-2xl tracking-tight">{t("included.title")}</h2>
          <ul className="mt-6 grid gap-4 text-sm leading-relaxed text-foreground/80 sm:grid-cols-2">
            <li className="flex gap-3 border-l-2 border-primary pl-4">{t("included.lift_pass")}</li>
            <li className="flex gap-3 border-l-2 border-primary pl-4">{t("included.beginner_zone")}</li>
            <li className="flex gap-3 border-l-2 border-primary pl-4">{t("included.gear")}</li>
            <li className="flex gap-3 border-l-2 border-primary pl-4">{t("included.ages")}</li>
            <li className="flex gap-3 border-l-2 border-primary pl-4">{t("included.video")}</li>
          </ul>
          <p className="mt-8 text-[12px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("included.languages_label")}{" "}
            <span className="text-foreground/80">{t("included.languages")}</span>
          </p>
        </section>
      </Reveal>
    </main>
  );
}
