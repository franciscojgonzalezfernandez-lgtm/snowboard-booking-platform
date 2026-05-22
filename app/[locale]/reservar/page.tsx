import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Duration } from "@prisma/client";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { BookingHeader } from "./booking-header";
import { BookingStepper } from "./booking-stepper";
import { DurationPicker } from "./duration-picker";

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
  if (sp.dt) {
    return {
      title: `${durationLabel} · ${sp.dt} — Snowboard Booking Platform`,
    };
  }
  return { title: `${durationLabel} — Snowboard Booking Platform` };
}

export default async function ReservarPage({
  params,
  searchParams,
}: ReservarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const parsedDuration = durationSchema.safeParse(sp.d);
  const initialDuration = parsedDuration.success ? parsedDuration.data : undefined;

  const t = await getTranslations({ locale, namespace: "reservar.step1" });
  const tShell = await getTranslations({ locale, namespace: "reservar.shell" });

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
