"use client";

import { useTranslations } from "next-intl";
import type { Duration } from "@prisma/client";

import { Link } from "@/i18n/navigation";
import { Stagger, StaggerItem } from "@/lib/motion/stagger";

export type PricingTier = {
  duration: Duration;
  /** Pre-formatted CHF string from the active Season (server-side). */
  priceLabel: string;
};

/** Maps the Prisma `Duration` enum to its `pricing.tier.*` i18n key. */
const TIER_KEY: Record<Duration, string> = {
  ONE_HOUR: "oneHour",
  TWO_HOURS: "twoHours",
  INTENSIVE: "intensive",
  FULL_DAY: "fullDay",
};

export function PricingTiers({ tiers }: { tiers: PricingTier[] }) {
  const t = useTranslations("pricing");

  return (
    <Stagger
      className="grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2 xl:grid-cols-4"
      gap={0.09}
    >
      {tiers.map((tier) => {
        const key = TIER_KEY[tier.duration];
        const points = t.raw(`tier.${key}.points`) as string[];
        const facets = t.raw(`tier.${key}.facets`) as string[];
        const hasPerk = t.has(`tier.${key}.perk`);

        return (
          <StaggerItem key={tier.duration} className="flex">
            <article
              data-testid={`pricing-card-${tier.duration}`}
              className="flex w-full flex-col bg-background p-7"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                {t(`tier.${key}.kicker`)}
              </p>
              <h2 className="mt-3 font-display text-2xl leading-tight tracking-tight">
                {t(`tier.${key}.name`)}
              </h2>

              <p className="mt-4 text-lg" data-testid={`pricing-price-${tier.duration}`}>
                <span className="font-display tracking-tight">{tier.priceLabel}</span>
                <span className="text-muted-foreground"> · {t("price_suffix")}</span>
              </p>

              <p className="mt-4 text-sm leading-relaxed text-foreground/85">
                {t(`tier.${key}.blurb`)}
              </p>

              <ul className="mt-5 space-y-2 text-sm leading-relaxed text-foreground/80">
                {points.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-primary">
                      —
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              {hasPerk ? (
                <p
                  data-testid={`pricing-perk-${tier.duration}`}
                  className="mt-5 border-l-2 border-primary pl-4 text-sm leading-relaxed text-foreground/75"
                >
                  {t(`tier.${key}.perk`)}
                </p>
              ) : null}

              <div className="mt-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("best_for_label")}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {facets.map((facet) => (
                    <li
                      key={facet}
                      className="inline-flex border border-foreground/20 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-foreground/70"
                    >
                      {facet}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                {t("meeting_label")} {t(`tier.${key}.meeting`)}.
              </p>

              <Link
                href={{ pathname: "/reservar", query: { d: tier.duration } }}
                data-testid={`pricing-cta-${tier.duration}`}
                className="mt-auto inline-block border-2 border-foreground bg-foreground px-6 py-4 text-center text-[12px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                {t("cta")}
              </Link>
            </article>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
