import { getTranslations } from "next-intl/server";
import type { Duration } from "@prisma/client";

import { CardScroller, scrollerItem } from "@/components/marketing/card-scroller";
import { TierPhoto } from "@/components/marketing/tier-photo";
import { Link } from "@/i18n/navigation";
import { RECOMMENDED_TIER, TIER_KEY } from "@/lib/pricing/tiers";
import { Stagger, StaggerItem } from "@/lib/motion/stagger";
import { cn } from "@/lib/utils";

export type PricingTier = {
  duration: Duration;
  /** Pre-formatted CHF string from the active Season (server-side). */
  priceLabel: string;
};

// Two columns from `sm`, four from `xl` — these cards are dense, so four of
// them only stop feeling cramped on a wide canvas.
const TIER_PHOTO_SIZES =
  "(min-width: 1320px) 320px, (min-width: 1280px) 25vw, (min-width: 640px) 50vw, 78vw";

/**
 * Server Component on purpose. It used to be `"use client"` for no reason other
 * than `useTranslations`, which meant the card markup — and, once F-132 added
 * `cn`, tailwind-merge with it — shipped to the browser. Only `<Stagger>` needs
 * the client; everything around it renders on the server.
 */
export async function PricingTiers({ tiers }: { tiers: PricingTier[] }) {
  const t = await getTranslations("pricing");

  return (
    // Mobile: a snap rail with a peek of the next product. ≥sm: the grid.
    // Separate bordered cards rather than the old hairline slab — these are
    // four different products and should not read as one table (F-132).
    <CardScroller>
      <Stagger
        className="flex items-stretch gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4"
        gap={0.09}
      >
        {tiers.map((tier) => {
          const key = TIER_KEY[tier.duration];
          const points = t.raw(`tier.${key}.points`) as string[];
          const facets = t.raw(`tier.${key}.facets`) as string[];
          const hasPerk = t.has(`tier.${key}.perk`);
          const recommended = key === RECOMMENDED_TIER;

          return (
            <StaggerItem key={tier.duration} className={scrollerItem()}>
              <article
                data-testid={`pricing-card-${tier.duration}`}
                className={cn(
                  "group flex w-full flex-col overflow-hidden border-2 bg-background",
                  recommended ? "border-primary" : "border-foreground",
                )}
              >
                <TierPhoto
                  tier={key}
                  alt={t(`tier.${key}.photo_alt`)}
                  durationLabel={t(`tier.${key}.length`)}
                  flag={recommended ? t(`tier.${key}.flag`) : undefined}
                  sizes={TIER_PHOTO_SIZES}
                  className="aspect-[16/10]"
                />

                <div className="flex flex-1 flex-col p-7">
                  {/* Two lines' worth of room whatever the name's length, so
                      the prices below line up across the row — this is a
                      comparison, and a ragged price line breaks the scan. */}
                  <h2 className="text-balance font-display text-[clamp(22px,2.1vw,28px)] uppercase leading-[1.05] tracking-tight sm:min-h-[2.1em]">
                    {t(`tier.${key}.product`)}
                  </h2>
                  {/* The keyword-led name still ships: it is what the Course
                      JSON-LD is built from, and it is how people search. */}
                  <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                    {t(`tier.${key}.name`)}
                  </p>

                  <p
                    className="mt-5 flex flex-wrap items-baseline gap-x-2"
                    data-testid={`pricing-price-${tier.duration}`}
                  >
                    <span className="font-display text-[30px] leading-none tracking-tight">
                      {tier.priceLabel}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {t("price_suffix")}
                    </span>
                  </p>

                  <p className="mt-5 text-sm leading-relaxed text-foreground/85">
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
                      className="mt-5 bg-secondary p-4 text-sm leading-relaxed text-foreground/80"
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

                  <p className="mt-5 pb-7 text-xs leading-relaxed text-muted-foreground">
                    {t("meeting_label")} {t(`tier.${key}.meeting`)}.
                  </p>

                  <Link
                    href={{ pathname: "/reservar", query: { d: tier.duration } }}
                    data-testid={`pricing-cta-${tier.duration}`}
                    className="mt-auto inline-block border-2 border-foreground bg-foreground px-6 py-4 text-center text-[12px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    {t("cta")}
                  </Link>
                </div>
              </article>
            </StaggerItem>
          );
        })}
      </Stagger>
    </CardScroller>
  );
}
