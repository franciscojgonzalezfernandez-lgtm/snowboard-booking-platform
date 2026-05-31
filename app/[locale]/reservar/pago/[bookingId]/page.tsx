import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Duration } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resumePaymentWith } from "@/lib/booking/resume-payment";
import { getStripe } from "@/lib/stripe/server";
import { formatChf } from "@/lib/pricing/format";

import { PaymentBlock } from "../../payment-block";

export const dynamic = "force-dynamic";

const INTL_TAG: Record<string, string> = {
  en: "en-CH",
  de: "de-CH",
  es: "es-CH",
};

// ONE_HOUR=60 · TWO_HOURS=120 · INTENSIVE=240 · FULL_DAY=360 (see
// lib/booking-engine/duration.ts) → the reservar.step1 duration labels.
const DURATION_LABEL_KEY: Record<
  Duration,
  "duration_1h" | "duration_2h" | "duration_4h" | "duration_6h"
> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

function formatBookingDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale] ?? "en-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

type Props = {
  params: Promise<{ locale: string; bookingId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.resume" });
  return { title: t("metadata_title") };
}

export default async function ResumePaymentPage({ params }: Props) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/${locale}/login?next=/${locale}/reservar/pago/${bookingId}`);
  }

  const t = await getTranslations({ locale, namespace: "reservar.resume" });
  const tStep1 = await getTranslations({ locale, namespace: "reservar.step1" });
  const tStep5 = await getTranslations({ locale, namespace: "reservar.step5" });

  const result = await resumePaymentWith(
    {
      prisma: prisma as unknown as Parameters<typeof resumePaymentWith>[0]["prisma"],
      stripe: getStripe(),
      bookerId: session.user.id,
    },
    bookingId,
  );

  if (!result.ok) {
    switch (result.error) {
      case "ALREADY_CONFIRMED":
        redirect(`/${locale}/reservar/exito/${bookingId}`);
      case "NOT_FOUND":
      case "FORBIDDEN":
      case "NOT_RESUMABLE":
      case "EXPIRED":
      case "STRIPE_BAD_STATE":
        redirect(`/${locale}/dashboard`);
    }
  }

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error(
      "STRIPE_PUBLISHABLE_KEY is not set — required to mount the resume Payment Element.",
    );
  }

  // Booking display fields for the ticket stub. The booker already owns this row
  // (resumePaymentWith rejects FORBIDDEN), so no second ownership check is needed.
  const details = await prisma.booking.findUnique({
    where: { id: result.bookingId },
    select: {
      date: true,
      anchorTime: true,
      duration: true,
      instructor: { select: { user: { select: { name: true } } } },
      _count: { select: { attendees: true } },
    },
  });
  if (!details) redirect(`/${locale}/dashboard`);

  const dateLabel = formatBookingDate(details.date, locale);
  const durationLabel = tStep1(DURATION_LABEL_KEY[details.duration]);
  const instructorName = details.instructor.user.name ?? "—";
  const attendeesCount = details._count.attendees;
  const hasCredits = result.creditsAppliedCents > 0;

  const meta: Array<{ label: string; value: string }> = [
    { label: tStep5("summary_time"), value: details.anchorTime },
    { label: tStep5("summary_duration"), value: durationLabel },
    { label: tStep5("summary_instructor"), value: instructorName },
    {
      label: tStep5("summary_attendees"),
      value: tStep5("summary_attendees_count", { count: attendeesCount }),
    },
  ];

  return (
    <main
      data-testid="resume-payment-page"
      className="mx-auto max-w-md px-6 pb-24 pt-16 sm:pt-24"
    >
      <header className="space-y-3">
        <p
          data-testid="resume-eyebrow"
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        >
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("sub")}
        </p>
      </header>

      <article className="relative mt-10 rounded-lg border border-border bg-secondary/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 motion-safe:ease-out">
        {/* Stub: the lesson, like the top half of a torn ticket. */}
        <div className="space-y-5 p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
            {t("ticket_eyebrow")}
          </p>
          <p
            data-testid="resume-ticket-date"
            className="font-display text-3xl leading-none tracking-tight"
          >
            {dateLabel}
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
            {meta.map((row) => (
              <div key={row.label} className="space-y-1">
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Perforation: a torn edge between the stub and the payment. */}
        <div className="relative" aria-hidden="true">
          <div className="border-t border-dashed border-border" />
          <span className="absolute -left-[9px] top-1/2 size-[18px] -translate-y-1/2 rounded-full border border-border bg-background" />
          <span className="absolute -right-[9px] top-1/2 size-[18px] -translate-y-1/2 rounded-full border border-border bg-background" />
        </div>

        {/* Counterfoil: what's owed + the card. */}
        <div className="space-y-6 p-7">
          <dl className="space-y-2.5">
            {hasCredits ? (
              <>
                <div
                  data-testid="resume-lesson-price"
                  className="flex items-baseline justify-between text-sm"
                >
                  <dt className="text-muted-foreground">
                    {tStep5("summary_lesson_price")}
                  </dt>
                  <dd className="tabular-nums">
                    {formatChf(result.totalPriceCents)}
                  </dd>
                </div>
                <div
                  data-testid="resume-credits-applied"
                  className="flex items-baseline justify-between text-sm"
                >
                  <dt className="text-muted-foreground">
                    {tStep5("summary_credits")}
                  </dt>
                  <dd className="tabular-nums">
                    −{formatChf(result.creditsAppliedCents)}
                  </dd>
                </div>
              </>
            ) : null}
            <div
              data-testid="resume-total"
              className={`flex items-baseline justify-between ${
                hasCredits ? "border-t border-border pt-3" : ""
              }`}
            >
              <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {tStep5("summary_charge")}
              </dt>
              <dd className="font-display text-2xl tracking-tight tabular-nums text-primary">
                {formatChf(result.chargeAmountCents)}
              </dd>
            </div>
          </dl>

          <PaymentBlock
            locale={locale}
            publishableKey={publishableKey}
            clientSecret={result.clientSecret}
            bookingId={result.bookingId}
            totalLabel={formatChf(result.chargeAmountCents)}
          />
        </div>
      </article>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("vat_note")}
      </p>
    </main>
  );
}
