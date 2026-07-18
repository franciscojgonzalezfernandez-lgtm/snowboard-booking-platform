import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { HeroAnnouncement } from "@/app/components/HeroAnnouncement";
import { auth } from "@/lib/auth";
import { marketingAlternates } from "@/lib/seo/page-metadata";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/lib/motion/reveal";
import { Stagger, StaggerItem } from "@/lib/motion/stagger";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

const TIERS = [
  { key: "oneHour", duration: "ONE_HOUR" },
  { key: "twoHours", duration: "TWO_HOURS" },
  { key: "intensive", duration: "INTENSIVE" },
  { key: "fullDay", duration: "FULL_DAY" },
] as const;

const REVIEW_IDS = ["1", "2", "3", "4"] as const;

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: t("metadata_title"),
    description: t("metadata_description"),
    alternates: marketingAlternates("/", locale),
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tPricing = await getTranslations("pricing");

  // F-107: hide the hero "sign in" CTA for authenticated visitors (it's
  // meaningless when logged in). Same session read as SiteNav; the marketing
  // layout already renders that async, so the home is already dynamic — no new
  // LCP cost (the hero image stays the static LCP element). "Reservar" stays.
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main>
      {/* Home-only promo band (F-053); renders nothing when disabled/dismissed. */}
      <HeroAnnouncement />

      {/* HERO — static (LCP-safe per F-090). Owner's photo via next/image. */}
      <section className="relative h-[86vh] min-h-[600px] max-h-[880px] overflow-hidden bg-foreground text-background">
        <Image
          src="/brand/hero.jpg"
          alt=""
          fill
          priority
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
              {!session?.user && (
                <Link
                  href="/login"
                  data-testid="hero-cta-signin"
                  className="rounded-md border-2 border-background bg-transparent px-8 py-[18px] text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-background hover:text-foreground"
                >
                  {t("cta_signin")}
                </Link>
              )}
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

          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map(({ key, duration }) => (
              <StaggerItem key={key}>
                <Link
                  href={{ pathname: "/reservar", query: { d: duration } }}
                  className="group flex h-full flex-col justify-between border-2 border-foreground bg-background p-7 transition-colors hover:bg-foreground hover:text-background"
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary group-hover:text-background">
                      {tPricing(`tier.${key}.kicker`)}
                    </p>
                    <h3 className="mt-2 font-display text-[26px] uppercase tracking-tight">
                      {t(`class_dur_${key}`)}
                    </h3>
                    <p className="mt-4 text-[15px] leading-[1.5] text-foreground/75 group-hover:text-background/80">
                      {t(`class_blurb_${key}`)}
                    </p>
                  </div>
                  <span className="mt-8 text-[12px] font-bold uppercase tracking-[0.2em]">
                    {t("class_cta")} →
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
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

      {/* REVIEWS — 5 stars + names. Placeholder quotes; owner pastes real ones. */}
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

          <Stagger className="mt-12 grid gap-4 md:grid-cols-2">
            {REVIEW_IDS.map((id) => (
              <StaggerItem key={id}>
                <figure className="flex h-full flex-col border-2 border-foreground bg-background p-7">
                  <div className="mb-5 flex gap-1" role="img" aria-label="5 / 5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className="size-4 fill-primary text-primary"
                        aria-hidden
                      />
                    ))}
                  </div>
                  <blockquote className="flex-1 text-[17px] leading-[1.55] text-foreground/85">
                    “{t(`review_${id}_quote`)}”
                  </blockquote>
                  <figcaption className="mt-6 text-[12px] font-bold uppercase tracking-[0.16em]">
                    {t(`review_${id}_name`)}
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
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
