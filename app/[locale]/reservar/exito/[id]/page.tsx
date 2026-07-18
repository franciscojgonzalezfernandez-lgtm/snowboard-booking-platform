import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookingStatus, type Duration } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";

type ExitoPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

const DURATION_LABEL_KEY: Record<Duration, string> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

const INTL_TAG: Record<string, string> = {
  en: "en-CH",
  de: "de-CH",
  es: "es-CH",
};

function formatBookingDate(date: Date, locale: string): string {
  const tag = INTL_TAG[locale] ?? "en-CH";
  return new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export async function generateMetadata({
  params,
}: ExitoPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reservar.exito" });
  return { title: t("metadata_title") };
}

export default async function ExitoPage({ params }: ExitoPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "reservar.exito" });
  const tStep1 = await getTranslations({
    locale,
    namespace: "reservar.step1",
  });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/${locale}/login?next=/${locale}/reservar/exito/${id}`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      bookerId: true,
      status: true,
      date: true,
      anchorTime: true,
      duration: true,
      totalPriceCents: true,
      booker: { select: { name: true } },
      instructor: { select: { user: { select: { name: true } } } },
      attendees: { select: { id: true } },
    },
  });

  if (!booking || booking.bookerId !== session.user.id) {
    return (
      <main
        data-testid="exito-forbidden"
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16"
      >
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">
          {t("forbidden_title")}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("forbidden_body")}
        </p>
        <Link
          href={{ pathname: "/login", query: { next: `/reservar/exito/${id}` } }}
          className="mt-8 inline-flex items-center justify-center self-start rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
        >
          {t("forbidden_cta")}
        </Link>
      </main>
    );
  }

  const status = booking.status;
  const isConfirmed =
    status === BookingStatus.CONFIRMED || status === BookingStatus.COMPLETED;
  const isPending = status === BookingStatus.PENDING_PAYMENT;
  const isFailed = status === BookingStatus.PAYMENT_FAILED;

  // F-107: a lesson that already happened can't be added to a calendar. Same
  // start-instant computation as the dashboard row (booking-row.tsx). Covers
  // COMPLETED (always past) and a CONFIRMED booking whose slot has since passed.
  const isPast =
    setUtcTime(startOfUtcDay(booking.date), booking.anchorTime).getTime() <=
    Date.now();

  const heading = isConfirmed
    ? t("heading_confirmed", { name: booking.booker.name ?? "" })
    : isFailed
      ? t("heading_failed")
      : t("heading_pending");

  const body = isConfirmed
    ? t("body_confirmed")
    : isFailed
      ? t("body_failed")
      : t("body_pending");

  const dateLabel = formatBookingDate(booking.date, locale);
  const durationLabel = tStep1(DURATION_LABEL_KEY[booking.duration]);
  const instructorName = booking.instructor.user.name ?? "—";
  const totalLabel = formatChf(booking.totalPriceCents);
  const attendeesCount = booking.attendees.length;

  return (
    <main
      data-testid="exito-page"
      data-status={status}
      className="mx-auto max-w-2xl px-6 py-16"
    >
      {isPending ? (
        <meta
          httpEquiv="refresh"
          content="3"
          data-testid="exito-pending-meta"
        />
      ) : null}

      <header className="space-y-2">
        <p
          data-testid="exito-eyebrow"
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        >
          {t("eyebrow")}
        </p>
        <h1
          data-testid="exito-heading"
          className="font-display text-4xl tracking-tight sm:text-5xl"
        >
          {heading}
        </h1>
        <p data-testid="exito-body" className="text-sm text-muted-foreground">
          {body}
        </p>
        {isPending ? (
          <p
            data-testid="exito-pending-fallback"
            className="text-xs text-muted-foreground"
          >
            {t("body_pending_fallback")}
          </p>
        ) : null}
      </header>

      <section
        data-testid="exito-summary"
        className="mt-10 rounded-md border border-input p-5 text-sm"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("summary_legend")}
        </p>
        <dl className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t("summary_date")}</dt>
            <dd className="font-medium" data-testid="exito-summary-date">
              {dateLabel}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t("summary_time")}</dt>
            <dd className="font-medium" data-testid="exito-summary-time">
              {booking.anchorTime}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t("summary_duration")}</dt>
            <dd className="font-medium" data-testid="exito-summary-duration">
              {durationLabel}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">
              {t("summary_instructor")}
            </dt>
            <dd
              className="font-medium"
              data-testid="exito-summary-instructor"
            >
              {instructorName}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t("summary_attendees")}</dt>
            <dd
              className="font-medium"
              data-testid="exito-summary-attendees"
            >
              {t("summary_attendees_count", { count: attendeesCount })}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-input pt-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("summary_total")}
          </span>
          <span
            className="font-display text-2xl tracking-tight"
            data-testid="exito-summary-total"
          >
            {totalLabel}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("summary_vat_note")}
        </p>
        <dl className="mt-4 grid grid-cols-[max-content,1fr] gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <dt>{t("booking_id_label")}</dt>
          <dd data-testid="exito-booking-id" className="font-mono">
            {booking.id}
          </dd>
        </dl>
      </section>

      {isConfirmed ? (
        <div className="mt-8 flex flex-wrap gap-3">
          {!isPast && (
            <a
              href={`/api/booking/${booking.id}/ics`}
              data-testid="exito-add-to-calendar"
              className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
            >
              {t("add_to_calendar")}
            </a>
          )}
          <Link
            href="/dashboard"
            data-testid="exito-go-to-dashboard"
            className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-background px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            {t("go_to_dashboard")}
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <Link
            href="/"
            data-testid="exito-back-home"
            className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
          >
            {t("back_home")}
          </Link>
        </div>
      )}
    </main>
  );
}
