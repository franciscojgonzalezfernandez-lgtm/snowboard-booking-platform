import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Duration, Locale } from "@prisma/client";
import { z } from "zod";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import {
  getCachedCalendar,
  getCachedSlots,
} from "@/lib/booking-engine/cache";
import { getPriceCents } from "@/lib/pricing/get-price";
import { BookingHeader } from "./booking-header";
import { BookingStepper } from "./booking-stepper";
import { BookerPaymentFlow } from "./booker-payment-flow";
import { DurationPicker } from "./duration-picker";
import { FreezeWhileDraft } from "./freeze-while-draft";
import { MonthCalendar } from "./month-calendar";
import { TimeInstructor } from "./time-instructor";

type ReservarSearchParams = {
  d?: string;
  dt?: string;
  t?: string;
  i?: string;
  l?: string;
  /** F-060: `credit=auto` expands + pre-selects redeemable credits in Step 4. */
  credit?: string;
};

type ReservarPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ReservarSearchParams>;
};

const durationSchema = z.enum(Duration);
const localeSchema = z.enum(Locale);
const dateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/u);

const DURATION_LABEL_KEY: Record<Duration, string> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
  searchParams,
}: ReservarPageProps): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "reservar.step1" });

  const parsedDuration = durationSchema.safeParse(sp.d);
  if (!parsedDuration.success) {
    return { title: t("metadata_title") };
  }

  const durationLabel = t(DURATION_LABEL_KEY[parsedDuration.data]);
  if (sp.dt && dateSchema.safeParse(sp.dt).success) {
    return {
      title: `${durationLabel} · ${sp.dt} — Snowboard Booking Platform`,
    };
  }
  return { title: `${durationLabel} — Snowboard Booking Platform` };
}

function monthBoundsUtc(month: string): { monthFrom: Date; monthTo: Date } {
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  return {
    monthFrom: new Date(Date.UTC(y, m - 1, 1)),
    monthTo: new Date(Date.UTC(y, m, 0)),
  };
}

function currentMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatDateForLocale(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const tag = locale === "en" ? "en-CH" : locale === "de" ? "de-CH" : "es-CH";
  return new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildLoginNext(locale: string, sp: ReservarSearchParams): string {
  const qs = new URLSearchParams();
  if (sp.d) qs.set("d", sp.d);
  if (sp.dt) qs.set("dt", sp.dt);
  if (sp.t) qs.set("t", sp.t);
  if (sp.i) qs.set("i", sp.i);
  if (sp.l) qs.set("l", sp.l);
  const query = qs.toString();
  return `/${locale}/reservar${query ? `?${query}` : ""}`;
}

export default async function ReservarPage({
  params,
  searchParams,
}: ReservarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const parsedDuration = durationSchema.safeParse(sp.d);
  const initialDuration = parsedDuration.success
    ? parsedDuration.data
    : undefined;

  const parsedDateStr =
    sp.dt && dateSchema.safeParse(sp.dt).success ? sp.dt : undefined;
  const parsedTime = sp.t && timeSchema.safeParse(sp.t).success ? sp.t : undefined;
  const parsedInstructor =
    sp.i && sp.i !== "ANYONE" ? sp.i : undefined;
  const parsedLanguage = (() => {
    const r = localeSchema.safeParse(sp.l);
    return r.success ? r.data : undefined;
  })();

  const t = await getTranslations({ locale, namespace: "reservar.step1" });
  const tShell = await getTranslations({ locale, namespace: "reservar.shell" });
  const tStep2 = await getTranslations({ locale, namespace: "reservar.step2" });
  const tStep3 = await getTranslations({ locale, namespace: "reservar.step3" });
  const tStep4 = await getTranslations({ locale, namespace: "reservar.step4" });
  const tStep5 = await getTranslations({ locale, namespace: "reservar.step5" });

  // Server-side prefetch into a per-request QueryClient. Dehydrated state
  // travels to the client via HydrationBoundary so the calendar + slots
  // islands hydrate with data instead of a loading flash on first paint.
  const queryClient = new QueryClient();

  if (initialDuration) {
    const month = parsedDateStr ? parsedDateStr.slice(0, 7) : currentMonth();
    const { monthFrom, monthTo } = monthBoundsUtc(month);
    await queryClient.prefetchQuery({
      queryKey: ["availability", "calendar", initialDuration, month],
      queryFn: async () => {
        const days = await getCachedCalendar(
          initialDuration,
          monthFrom.toISOString(),
          monthTo.toISOString(),
        );
        return { days };
      },
    });
  }

  if (initialDuration && parsedDateStr) {
    const isoDate = `${parsedDateStr}T00:00:00.000Z`;
    await queryClient.prefetchQuery({
      queryKey: ["availability", "slots", initialDuration, parsedDateStr],
      queryFn: () => getCachedSlots(initialDuration, isoDate),
    });
  }

  const dehydratedState = dehydrate(queryClient);

  // Section 4 reveals only when sections 1-3 are settled. Language is
  // optional in the URL (an instructor with a single language doesn't need
  // ?l=); we resolve it server-side if missing by reading the instructor's
  // first language from the slots prefetch result.
  const shouldRenderSection4 =
    !!initialDuration &&
    !!parsedDateStr &&
    !!parsedTime &&
    !!parsedInstructor;

  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  let instructorName: string | null = null;
  let resolvedLanguage: Locale | undefined = parsedLanguage;
  let publishableKey: string | undefined;
  let lessonPriceCents = 0;
  let redeemableCredits: Array<{
    id: string;
    amountCents: number;
    expiresAtIso: string;
  }> = [];
  if (shouldRenderSection4) {
    session = await auth.api.getSession({ headers: await headers() });
    publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error(
        "STRIPE_PUBLISHABLE_KEY is not set — required for Section 5 Payment Element",
      );
    }
    const inst = await prisma.instructor.findUnique({
      where: { id: parsedInstructor },
      select: { user: { select: { name: true } }, languages: true },
    });
    instructorName = inst?.user.name ?? null;
    if (!resolvedLanguage && inst?.languages?.length) {
      resolvedLanguage = inst.languages[0];
    }

    // F-060: lesson price + redeemable credits feed the Apply-credits section
    // and the Step 5 charge breakdown. The server action re-validates both, so
    // these are display-only — a stale value can never over-discount a charge.
    if (initialDuration && session?.user) {
      const [season, credits] = await Promise.all([
        prisma.season.findFirst({
          where: { active: true },
          select: { id: true, priceCentsByDuration: true },
        }),
        prisma.accountCredit.findMany({
          where: {
            userId: session.user.id,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
          orderBy: { expiresAt: "asc" },
          select: { id: true, amountCents: true, expiresAt: true },
        }),
      ]);
      if (season) {
        try {
          lessonPriceCents = getPriceCents(season, initialDuration);
        } catch {
          // Misconfigured season pricing surfaces as PRICING_MISSING when the
          // booker submits; the credit UI just renders without a price cap.
        }
      }
      redeemableCredits = credits.map((c) => ({
        id: c.id,
        amountCents: c.amountCents,
        expiresAtIso: c.expiresAt.toISOString(),
      }));
    }
  }

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: tShell("service_name"),
    serviceType: tShell("service_type"),
    areaServed: { "@type": "Place", name: "Flumserberg, Switzerland" },
    provider: {
      "@type": "LocalBusiness",
      name: "The Drop",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Flumserberg",
        addressCountry: "CH",
      },
    },
  };

  return (
    <>
      <BookingHeader />
      <BookingStepper />

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-12 sm:pt-16">
        <header className="space-y-2">
          <p
            data-testid="step-eyebrow"
            className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
          >
            {t("eyebrow")}
          </p>
          <h1
            data-testid="step1-title"
            className="font-display text-4xl tracking-tight"
          >
            {t("heading")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("sub")}</p>
        </header>

        <HydrationBoundary state={dehydratedState}>
          <FreezeWhileDraft>
            <section
              id="section-1"
              data-testid="section-1"
              aria-labelledby="section-1-heading"
              className="mt-10 scroll-mt-32"
            >
              <h2 id="section-1-heading" className="sr-only">
                {t("duration_label")}
              </h2>
              <DurationPicker initialDuration={initialDuration} />
            </section>

            {initialDuration && (
              <section
                id="section-2"
                data-testid="section-2"
                aria-labelledby="section-2-heading"
                className="mt-16 scroll-mt-32"
              >
                <header className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
                    {tStep2("eyebrow")}
                  </p>
                  <h2
                    id="section-2-heading"
                    data-testid="step2-title"
                    className="font-display text-3xl tracking-tight"
                  >
                    {tStep2("heading")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tStep2("sub")}
                  </p>
                </header>
                <div className="mt-8">
                  <MonthCalendar duration={initialDuration} />
                </div>
              </section>
            )}

            {initialDuration && parsedDateStr && (
              <section
                id="section-3"
                data-testid="section-3"
                aria-labelledby="section-3-heading"
                className="mt-16 scroll-mt-32"
              >
                <header className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
                    {tStep3("eyebrow")}
                  </p>
                  <h2
                    id="section-3-heading"
                    data-testid="step3-title"
                    className="font-display text-3xl tracking-tight"
                  >
                    {tStep3("heading")}
                  </h2>
                </header>
                <div className="mt-8">
                  <TimeInstructor
                    duration={initialDuration}
                    date={parsedDateStr}
                  />
                </div>
              </section>
            )}
          </FreezeWhileDraft>

          {shouldRenderSection4 && !session?.user && (
            <section
              id="section-4"
              data-testid="section-4-anonymous"
              aria-labelledby="section-4-anonymous-heading"
              className="mt-16 scroll-mt-32 rounded-md border border-input p-6"
            >
              <p
                data-testid="step4-eyebrow"
                className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
              >
                {tStep4("eyebrow")}
              </p>
              <h2
                id="section-4-anonymous-heading"
                data-testid="step4-anonymous-heading"
                className="mt-2 font-display text-3xl tracking-tight"
              >
                {tStep4("anonymous_heading")}
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                {tStep4("anonymous_body")}
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(buildLoginNext(locale, sp))}`}
                data-testid="step4-anonymous-cta"
                data-section-focus
                className="mt-6 inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
              >
                {tStep4("anonymous_cta")}
              </Link>
            </section>
          )}

          {shouldRenderSection4 &&
            session?.user &&
            publishableKey &&
            initialDuration &&
            parsedDateStr &&
            parsedTime &&
            parsedInstructor &&
            resolvedLanguage && (
              <BookerPaymentFlow
                locale={locale}
                publishableKey={publishableKey}
                bookerEmail={session.user.email ?? ""}
                bookerName={session.user.name ?? ""}
                duration={initialDuration}
                date={parsedDateStr}
                time={parsedTime}
                instructorId={parsedInstructor}
                language={resolvedLanguage}
                durationLabel={t(DURATION_LABEL_KEY[initialDuration])}
                instructorLabel={instructorName ?? "—"}
                dateLabel={formatDateForLocale(parsedDateStr, locale)}
                attendeeCountKey="summary_attendees_count"
                lessonPriceCents={lessonPriceCents}
                credits={redeemableCredits}
                autoApplyCredits={sp.credit === "auto"}
                section4={{
                  eyebrow: tStep4("eyebrow"),
                  heading: tStep4("heading"),
                  sub: tStep4("sub"),
                }}
                section5={{
                  eyebrow: tStep5("eyebrow"),
                  heading: tStep5("heading"),
                  sub: tStep5("sub"),
                }}
              />
            )}
        </HydrationBoundary>
      </main>

      <script
        type="application/ld+json"
        // RSC stringifies a server-built object — no XSS surface, but the
        // closing `</` is escaped to keep the parser inside <script> bounds.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(serviceJsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
