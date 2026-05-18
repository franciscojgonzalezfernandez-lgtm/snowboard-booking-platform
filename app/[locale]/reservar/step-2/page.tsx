import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Duration } from "@prisma/client";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { computeCalendar } from "@/lib/booking-engine";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { prisma } from "@/lib/db";
import { Step2Calendar } from "./step2-calendar";

const durationSchema = z.enum(Duration);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u);

type Step2PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ duration?: string; month?: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Step2PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.step2" });
  return { title: t("metadata_title") };
}

function isoMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthBounds(monthStr: string): { monthFrom: Date; monthTo: Date } {
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  return {
    monthFrom: new Date(Date.UTC(y, m - 1, 1)),
    monthTo: new Date(Date.UTC(y, m, 0)),
  };
}

export default async function Step2Page({
  params,
  searchParams,
}: Step2PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const parsedDuration = durationSchema.safeParse(sp.duration);
  if (!parsedDuration.success) {
    redirect(`/${locale}/reservar`);
  }
  const duration = parsedDuration.data;

  const todayMonth = isoMonth(new Date());
  const monthRaw = sp.month;
  const month =
    monthRaw && monthSchema.safeParse(monthRaw).success
      ? monthRaw
      : todayMonth;

  const { monthFrom, monthTo } = monthBounds(month);
  const ctx = await loadEngineContext(prisma, {
    from: monthFrom,
    to: monthTo,
  });
  const days = computeCalendar(ctx, { duration, monthFrom, monthTo });

  const t = await getTranslations({ locale, namespace: "reservar.step2" });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <div className="space-y-2">
        <p
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
          data-testid="step2-eyebrow"
        >
          {t("eyebrow")}
        </p>
        <h1
          className="font-display text-4xl tracking-tight"
          data-testid="step2-title"
        >
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
      </div>

      <div className="mt-10">
        <Step2Calendar
          duration={duration}
          initialMonth={month}
          initialDays={days}
        />
      </div>
    </main>
  );
}
