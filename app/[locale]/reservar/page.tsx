import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Duration } from "@prisma/client";
import { z } from "zod";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import {
  computeCalendar,
  computeSlotsForDate,
} from "@/lib/booking-engine";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { BookingHeader } from "./booking-header";
import { BookingStepper } from "./booking-stepper";
import { DurationPicker } from "./duration-picker";
import { MonthCalendar } from "./month-calendar";
import { TimeInstructor } from "./time-instructor";

type ReservarSearchParams = {
  d?: string;
  dt?: string;
  t?: string;
  i?: string;
  l?: string;
};

type ReservarPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ReservarSearchParams>;
};

const durationSchema = z.enum(Duration);
const dateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u);

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

  const t = await getTranslations({ locale, namespace: "reservar.step1" });
  const tShell = await getTranslations({ locale, namespace: "reservar.shell" });

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
        const ctx = await loadEngineContext(prisma, {
          from: monthFrom,
          to: monthTo,
        });
        const days = computeCalendar(ctx, {
          duration: initialDuration,
          monthFrom,
          monthTo,
        });
        return { days };
      },
    });
  }

  if (initialDuration && parsedDateStr) {
    const date = new Date(`${parsedDateStr}T00:00:00.000Z`);
    await queryClient.prefetchQuery({
      queryKey: ["availability", "slots", initialDuration, parsedDateStr],
      queryFn: async () => {
        const ctx = await loadEngineContext(prisma, { from: date, to: date });
        return computeSlotsForDate(ctx, {
          duration: initialDuration,
          date,
        });
      },
    });
  }

  const dehydratedState = dehydrate(queryClient);

  const tStep2 = await getTranslations({ locale, namespace: "reservar.step2" });
  const tStep3 = await getTranslations({ locale, namespace: "reservar.step3" });

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: tShell("service_name"),
    serviceType: tShell("service_type"),
    areaServed: { "@type": "Place", name: "Flumserberg, Switzerland" },
    provider: {
      "@type": "LocalBusiness",
      name: "Adlerhorst Snowboard School",
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
      <BookingStepper locale={locale} />

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
