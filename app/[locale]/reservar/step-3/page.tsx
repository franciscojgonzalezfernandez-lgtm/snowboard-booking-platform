import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Duration } from "@prisma/client";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { computeSlotsForDate } from "@/lib/booking-engine";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { prisma } from "@/lib/db";
import { Step3Selection } from "./step3-selection";

const durationSchema = z.enum(Duration);
const dateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u);

type Step3PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    duration?: string;
    date?: string;
    time?: string;
    instructor?: string;
    language?: string;
  }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Step3PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.step3" });
  return { title: t("metadata_title") };
}

export default async function Step3Page({
  params,
  searchParams,
}: Step3PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const parsedDuration = durationSchema.safeParse(sp.duration);
  if (!parsedDuration.success) {
    redirect(`/${locale}/reservar`);
  }
  const duration = parsedDuration.data;

  const parsedDate = dateSchema.safeParse(sp.date);
  if (!parsedDate.success) {
    redirect(`/${locale}/reservar/step-2?duration=${duration}`);
  }
  const isoDate = parsedDate.data;
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  const ctx = await loadEngineContext(prisma, { from: date, to: date });
  const slots = computeSlotsForDate(ctx, { duration, date });

  const t = await getTranslations({ locale, namespace: "reservar.step3" });
  const dateLabel = date.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <div className="space-y-2">
        <p
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
          data-testid="step3-eyebrow"
        >
          {t("eyebrow")}
        </p>
        <h1
          className="font-display text-4xl tracking-tight"
          data-testid="step3-title"
        >
          {t("heading")}
        </h1>
        <p
          className="text-sm text-muted-foreground"
          data-testid="step3-date-label"
        >
          {dateLabel}
        </p>
      </div>

      <div className="mt-10">
        <Step3Selection
          duration={duration}
          date={isoDate}
          slots={slots}
          initialTime={sp.time}
          initialInstructorId={sp.instructor}
          initialLanguage={sp.language}
        />
      </div>
    </main>
  );
}
