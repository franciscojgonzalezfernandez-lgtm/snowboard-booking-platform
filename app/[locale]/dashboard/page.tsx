import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookingStatus, type Duration } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

const DURATION_LABEL_KEY: Record<Duration, string> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

// Statuses considered actionable history for the booker. Failed payments,
// orphan PENDING_PAYMENT drafts left by abandoned checkouts, and
// system-cancelled rows (PaymentIntent canceled) are not surfaced because
// the booker cannot act on them and would only be confused by them.
// Sprint 3 will introduce explicit Upcoming / Past / Cancelled sections.
const VISIBLE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED_BY_USER,
  BookingStatus.CANCELLED_BY_OPS,
  BookingStatus.REFUNDED,
];

const STATUS_LABEL_KEY: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "status_pending_payment",
  CONFIRMED: "status_confirmed",
  COMPLETED: "status_completed",
  CANCELLED_BY_USER: "status_cancelled_by_user",
  CANCELLED_BY_OPS: "status_cancelled_by_ops",
  CANCELLED_BY_SYSTEM: "status_cancelled_by_system",
  PAYMENT_FAILED: "status_payment_failed",
  REFUNDED: "status_refunded",
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
}: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("metadata_title") };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/${locale}/login?next=/${locale}/dashboard`);
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tStep1 = await getTranslations({
    locale,
    namespace: "reservar.step1",
  });

  const userId = session.user.id;

  const [bookings, account] = await Promise.all([
    prisma.booking.findMany({
      where: { bookerId: userId, status: { in: VISIBLE_STATUSES } },
      orderBy: [{ date: "desc" }, { anchorTime: "desc" }],
      select: {
        id: true,
        date: true,
        anchorTime: true,
        duration: true,
        status: true,
        totalPriceCents: true,
        instructor: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    }),
  ]);

  const greetingName = account?.name?.trim().split(/\s+/)[0] ?? null;

  return (
    <main
      data-testid="dashboard-page"
      className="mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-20"
    >
      <header className="space-y-3 border-b border-input pb-10">
        <p
          data-testid="dashboard-eyebrow"
          className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground"
        >
          {t("eyebrow")}
        </p>
        <h1
          data-testid="dashboard-heading"
          className="font-display text-4xl tracking-tight sm:text-5xl"
        >
          {greetingName
            ? t("heading_personal", { name: greetingName })
            : t("heading")}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {t("sub")}
        </p>
      </header>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            data-testid="dashboard-bookings-heading"
            className="font-display text-2xl tracking-tight"
          >
            {t("section_bookings")}
          </h2>
          {bookings.length > 0 ? (
            <Link
              href="/reservar"
              data-testid="dashboard-book-again"
              className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
            >
              {t("book_another")}
            </Link>
          ) : null}
        </div>

        {bookings.length === 0 ? (
          <div
            data-testid="dashboard-empty"
            className="mt-6 flex flex-col items-start gap-5 border-l-2 border-foreground/80 bg-muted/20 px-8 py-10"
          >
            <p
              data-testid="dashboard-empty-heading"
              className="font-display text-2xl tracking-tight"
            >
              {t("empty_heading")}
            </p>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {t("empty_body")}
            </p>
            <Link
              href="/reservar"
              data-testid="dashboard-empty-cta"
              className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
            >
              {t("empty_cta")}
            </Link>
          </div>
        ) : (
          <ol
            data-testid="dashboard-bookings"
            className="mt-6 divide-y divide-input border-y border-input"
          >
            {bookings.map((booking) => {
              const statusLabel = t(STATUS_LABEL_KEY[booking.status]);
              const durationLabel = tStep1(
                DURATION_LABEL_KEY[booking.duration],
              );
              const instructorName = booking.instructor.user.name ?? "—";
              return (
                <li
                  key={booking.id}
                  data-testid="dashboard-booking-row"
                  data-booking-id={booking.id}
                  data-status={booking.status}
                  className="group grid gap-6 py-8 sm:grid-cols-[1fr,auto] sm:items-start"
                >
                  <div className="space-y-2">
                    <p
                      data-testid="dashboard-booking-status"
                      className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"
                    >
                      {statusLabel}
                    </p>
                    <p
                      data-testid="dashboard-booking-date"
                      className="font-display text-2xl tracking-tight sm:text-3xl"
                    >
                      {formatBookingDate(booking.date, locale)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span data-testid="dashboard-booking-time">
                        {booking.anchorTime}
                      </span>
                      <span aria-hidden> · </span>
                      <span data-testid="dashboard-booking-duration">
                        {durationLabel}
                      </span>
                      <span aria-hidden> · </span>
                      <span data-testid="dashboard-booking-instructor">
                        {instructorName}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <p
                      data-testid="dashboard-booking-total"
                      className="font-display text-2xl tracking-tight"
                    >
                      {formatChf(booking.totalPriceCents)}
                    </p>
                    <Link
                      href={`/reservar/exito/${booking.id}`}
                      data-testid="dashboard-booking-link"
                      className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                    >
                      {t("view_details")} →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section
        data-testid="dashboard-account"
        className="mt-16 border-t border-input pt-10"
      >
        <h2
          data-testid="dashboard-account-heading"
          className="font-display text-2xl tracking-tight"
        >
          {t("personal_heading")}
        </h2>
        <dl className="mt-6 grid gap-x-10 gap-y-5 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("personal_name")}
            </dt>
            <dd
              data-testid="dashboard-account-name"
              className="font-display text-lg tracking-tight"
            >
              {account?.name ?? "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("personal_email")}
            </dt>
            <dd
              data-testid="dashboard-account-email"
              className="break-all font-display text-lg tracking-tight"
            >
              {account?.email ?? "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("personal_phone")}
            </dt>
            <dd
              data-testid="dashboard-account-phone"
              className="font-display text-lg tracking-tight"
            >
              {account?.phone ?? (
                <span className="text-muted-foreground">
                  {t("personal_phone_missing")}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
