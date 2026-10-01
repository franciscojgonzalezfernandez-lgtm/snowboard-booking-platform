import type { Metadata } from "next";
import type { Duration, Locale } from "@prisma/client";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { HeroAnnouncement } from "@/app/components/HeroAnnouncement";
import { CardScroller, scrollerItem } from "@/components/marketing/card-scroller";
import { GoogleReviewBadge } from "@/components/marketing/google-review-badge";
import { PromoPrice } from "@/components/pricing/promo-price";
import { TierPhoto } from "@/components/marketing/tier-photo";
import { marketingAlternates, marketingOpenGraph } from "@/lib/seo/page-metadata";
import { getActiveSeasonForPricing } from "@/lib/marketing/cache";
import { formatChf } from "@/lib/pricing/format";
import {
  getPromoLabel,
  PriceConfigurationError,
  resolvePriceCents,
} from "@/lib/pricing/get-price";
import { RECOMMENDED_TIER, TIER_KEY, TIER_ORDER } from "@/lib/pricing/tiers";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/lib/motion/reveal";
import { Stagger, StaggerItem } from "@/lib/motion/stagger";
import { cn } from "@/lib/utils";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

const REVIEW_IDS = ["1", "2", "3", "4"] as const;

// One card is ~1/4 of the 1320px canvas on desktop and a peeking 78vw on
// mobile; without this the optimizer would ship the full 1600px source to a
// 300px slot four times over.
const TIER_PHOTO_SIZES =
  "(min-width: 1320px) 320px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 78vw";

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
    alternates: marketingAlternates("/", locale),
    openGraph: marketingOpenGraph("/", locale),
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tPricing = await getTranslations("pricing");

  // F-141: the home tier cards now show prices (with promo strikethrough). Read
  // the active season via the cached, `pricing`-tagged reader so the page stays
  // static (F-124) and picks up owner edits on tag invalidation. A missing or
  // malformed price for a duration simply omits that card's price — the card
  // still links to the funnel — so the landing page never fails on pricing.
  const season = await getActiveSeasonForPricing();
  type CardPrice = {
    priceLabel: string;
    originalPriceLabel: string | null;
    promoLabel: string | null;
  };
  const priceByDuration: Partial<Record<Duration, CardPrice>> = {};
  if (season) {
    for (const duration of TIER_ORDER) {
      try {
        const resolved = resolvePriceCents(season, duration);
        priceByDuration[duration] = {
          priceLabel: formatChf(resolved.cents),
          originalPriceLabel: resolved.isPromo
            ? formatChf(resolved.originalCents)
            : null,
          promoLabel: resolved.isPromo
            ? getPromoLabel(season, duration, locale as Locale)
            : null,
        };
      } catch (error) {
        if (!(error instanceof PriceConfigurationError)) throw error;
        // Leave this duration priceless; the card still links to the funnel.
      }
    }
  }

  return (
    <main>
      {/* Home-only promo band (F-053); renders nothing when disabled/dismissed. */}
      <HeroAnnouncement />

      {/* HERO — static (LCP-safe per F-090). Owner's photo via next/image. */}
      <section className="relative h-[86vh] min-h-[600px] max-h-[880px] overflow-hidden bg-foreground text-background">
        {/* `priority` emits the preload link, but Next 15.5 stops there — it
            does not set fetchpriority on the <img>, which is what Lighthouse's
            LCP request-discovery audit checks. Passing it explicitly (F-124). */}
        <Image
          src="/brand/hero.jpg"
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[rgba(20,14,8,0.80)] via-[rgba(20,14,8,0.12)] to-[rgba(20,14,8,0.55)]"
        />

        <div className="relative flex h-full flex-col justify-end px-7 pb-14 pt-8">
          <div className="mx-auto w-full max-w-[1320px]">
            <div className="mb-7 inline-flex items-center gap-4 text-[12px] font-bold uppercase tracking-[0.28em]">
              <span
                className="block h-[2px] w-12 bg-primary"
                aria-hidden
              ></span>
              <span>{t("eyebrow")}</span>
            </div>

            <h1 className="mb-6 max-w-[16ch] text-balance font-display text-[clamp(34px,9vw,128px)] leading-[0.9] tracking-[-0.02em] uppercase">
              {t("hero_title_1")} {t("hero_title_2")}{" "}
              <span className="text-primary">{t("hero_accent")}.</span>
            </h1>

            <p className="mb-9 max-w-[600px] text-lg leading-[1.45] text-background/85">
              {t("hero_sub")}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/reservar"
                data-testid="hero-cta-primary"
                className="rounded-md border-2 border-primary bg-primary px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-destructive hover:border-destructive"
              >
                {t("cta_primary")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO — passionate, first-person */}
      <section className="bg-background px-7 py-24 lg:py-32">
        <div className="mx-auto max-w-[1100px]">
          <Reveal>
            <p className="mb-6 text-[12px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {t("intro_eyebrow")}
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="max-w-[18ch] font-display text-[clamp(28px,5vw,60px)] leading-[1.02] tracking-[-0.015em] uppercase">
              {t("intro_title")}
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-8 max-w-[64ch] text-xl leading-[1.55] text-foreground/80">
              {t("intro_body")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* CLASSES — 4 tiers, links to the funnel */}
      <section className="border-t-2 border-foreground bg-secondary px-7 py-24 lg:py-32">
        <div className="mx-auto max-w-[1320px]">
          <Reveal>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {t("classes_eyebrow")}
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="max-w-[20ch] font-display text-[clamp(26px,4.5vw,52px)] leading-[1.02] tracking-[-0.015em] uppercase">
              {t("classes_title")}
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 max-w-[60ch] text-lg text-foreground/70">
              {t("classes_sub")}
            </p>
          </Reveal>

          {/* Mobile: a snap rail — four products you swipe, not four screens
              you scroll past. ≥sm: the grid, unchanged (F-132). */}
          <CardScroller className="mt-12">
            <Stagger className="flex items-stretch gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {TIER_ORDER.map((duration) => {
                const key = TIER_KEY[duration];
                const recommended = key === RECOMMENDED_TIER;
                const price = priceByDuration[duration];

                return (
                  <StaggerItem key={duration} className={scrollerItem()}>
                    <Link
                      href={{ pathname: "/reservar", query: { d: duration } }}
                      data-testid={`home-tier-${duration}`}
                      // The accent border is reserved for the recommended
                      // tier — hover must not borrow it, or every card looks
                      // recommended under the cursor. Hover is carried by the
                      // photo zoom and the CTA bar filling in.
                      className={cn(
                        "group flex w-full flex-col overflow-hidden border-2 bg-background",
                        recommended ? "border-primary" : "border-foreground",
                      )}
                    >
                      <TierPhoto
                        tier={key}
                        alt={tPricing(`tier.${key}.photo_alt`)}
                        durationLabel={tPricing(`tier.${key}.length`)}
                        flag={recommended ? tPricing(`tier.${key}.flag`) : undefined}
                        sizes={TIER_PHOTO_SIZES}
                        className="aspect-[4/3]"
                      />

                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="font-display text-[clamp(22px,2.1vw,28px)] uppercase leading-[1.05] tracking-tight text-balance">
                          {tPricing(`tier.${key}.product`)}
                        </h3>
                        <p className="mt-3 text-[15px] leading-[1.5] text-foreground/75">
                          {t(`class_blurb_${key}`)}
                        </p>
                        {price ? (
                          <div
                            className="mt-auto pt-5"
                            data-testid={`home-price-${duration}`}
                          >
                            <PromoPrice
                              priceClassName="font-display text-[22px]"
                              priceLabel={price.priceLabel}
                              originalPriceLabel={price.originalPriceLabel}
                              promoLabel={price.promoLabel}
                              regularPriceA11yLabel={tPricing(
                                "regular_price_a11y",
                              )}
                            />
                          </div>
                        ) : null}
                      </div>

                      <span className="flex items-center justify-between border-t-2 border-foreground px-6 py-4 text-[12px] font-bold uppercase tracking-[0.18em] transition-colors group-hover:bg-foreground group-hover:text-background">
                        {t("class_cta")}
                        <span
                          aria-hidden
                          className="transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </CardScroller>
        </div>
      </section>

      {/* INSTRUCTOR teaser — Javi */}
      <section className="bg-background px-7 py-24 lg:py-32">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <Reveal>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {t("instructor_eyebrow")}
            </p>
            <h2 className="font-display text-[clamp(30px,5vw,68px)] leading-[0.98] tracking-[-0.015em] uppercase">
              {t("instructor_name")}
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-xl leading-[1.55] text-foreground/80">
              {t("instructor_body")}
            </p>
            <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.2em] text-primary">
              {t("instructor_langs")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* REVIEWS — real Google Business reviews, attributed with the Google
          mark (F-132) so the five stars are evidence, not decoration. */}
      <section className="border-t-2 border-foreground bg-secondary px-7 py-24 lg:py-32">
        <div className="mx-auto max-w-[1320px]">
          <Reveal>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {t("reviews_eyebrow")}
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="max-w-[20ch] font-display text-[clamp(26px,4.5vw,52px)] leading-[1.02] tracking-[-0.015em] uppercase">
              {t("reviews_title")}
            </h2>
          </Reveal>

          <CardScroller className="mt-12">
            {/* The grid must start at the breakpoint the scroller stops
                snapping at (`sm`), or four flex items share one row. */}
            <Stagger className="flex items-stretch gap-4 sm:grid sm:grid-cols-2">
              {REVIEW_IDS.map((id) => (
                <StaggerItem key={id} className={scrollerItem("w-[86vw]")}>
                  <figure className="flex w-full flex-col border-2 border-foreground bg-background p-7">
                    <GoogleReviewBadge
                      label={t("reviews_source")}
                      rating={t("reviews_rating")}
                    />
                    {/* Slightly smaller on the rail: these are long real
                        reviews and the tallest one sets the rail height. */}
                    <blockquote className="flex-1 text-[15px] leading-[1.55] text-foreground/85 sm:text-[17px]">
                      “{t(`review_${id}_quote`)}”
                    </blockquote>
                    <figcaption className="mt-6 text-[12px] font-bold uppercase tracking-[0.16em]">
                      {t(`review_${id}_name`)}
                    </figcaption>
                  </figure>
                </StaggerItem>
              ))}
            </Stagger>
          </CardScroller>
        </div>
      </section>

      {/* FINAL CTA — brand moment with the full logo */}
      <section className="bg-background px-7 py-24 text-center lg:py-32">
        <div className="mx-auto max-w-[820px]">
          <Reveal>
            <Image
              src="/brand/logo-full.png"
              alt="Ride Flumserberg"
              width={520}
              height={458}
              className="mx-auto mb-10 h-auto w-[min(80%,440px)]"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-[clamp(30px,6vw,72px)] leading-[0.98] tracking-[-0.015em] uppercase">
              {t("final_title")}
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-9 flex justify-center">
              <Link
                href="/reservar"
                className="rounded-md border-2 border-primary bg-primary px-10 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-destructive hover:border-destructive"
              >
                {t("final_cta")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
