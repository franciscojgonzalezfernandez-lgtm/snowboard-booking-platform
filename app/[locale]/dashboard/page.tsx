import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  BookingStatus,
  CreditStatus,
  type Duration,
  type Locale as DbLocale,
} from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

type SectionKind = "upcoming" | "past" | "cancelled";

const DURATION_LABEL_KEY: Record<Duration, string> = {
  ONE_HOUR: "duration_1h",
  TWO_HOURS: "duration_2h",
  INTENSIVE: "duration_4h",
  FULL_DAY: "duration_6h",
};

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

function formatShortDate(date: Date, locale: string): string {
  const tag = INTL_TAG[locale] ?? "en-CH";
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// `Booking.date` is `@db.Date` (UTC midnight). "Today" must be the UTC date
// midnight so date-only comparisons stay consistent regardless of server TZ.
function utcStartOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function classifyBooking(
  status: BookingStatus,
  date: Date,
  today: Date,
): SectionKind | null {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return date.getTime() >= today.getTime() ? "upcoming" : "past";
    case BookingStatus.COMPLETED:
      return "past";
    case BookingStatus.CANCELLED_BY_USER:
    case BookingStatus.CANCELLED_BY_OPS:
    case BookingStatus.CANCELLED_BY_SYSTEM:
    case BookingStatus.REFUNDED:
    case BookingStatus.PAYMENT_FAILED:
      return "cancelled";
    case BookingStatus.PENDING_PAYMENT:
      return null;
  }
}

type BookingRow = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: DbLocale;
  status: BookingStatus;
  totalPriceCents: number;
  cancelledByUserAt: Date | null;
  cancelledByOpsAt: Date | null;
  opsReason: string | null;
  refundedAt: Date | null;
  refundAmountCents: number | null;
  instructor: { user: { name: string | null } };
};

type CreditRow = {
  id: string;
  amountCents: number;
  sourceBookingId: string;
  expiresAt: Date;
  status: CreditStatus;
};

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

  const [bookings, credits, account] = await Promise.all([
    prisma.booking.findMany({
      where: { bookerId: userId, status: { not: BookingStatus.PENDING_PAYMENT } },
      orderBy: [{ date: "desc" }, { anchorTime: "desc" }],
      select: {
        id: true,
        date: true,
        anchorTime: true,
        duration: true,
        language: true,
        status: true,
        totalPriceCents: true,
        cancelledByUserAt: true,
        cancelledByOpsAt: true,
        opsReason: true,
        refundedAt: true,
        refundAmountCents: true,
        instructor: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.accountCredit.findMany({
      where: { userId, sourceBooking: { bookerId: userId } },
      select: {
        id: true,
        amountCents: true,
        sourceBookingId: true,
        expiresAt: true,
        status: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    }),
  ]);

  const today = utcStartOfToday();
  const creditsBySource = new Map<string, CreditRow>();
  for (const credit of credits) {
    creditsBySource.set(credit.sourceBookingId, credit);
  }

  const groups: Record<SectionKind, BookingRow[]> = {
    upcoming: [],
    past: [],
    cancelled: [],
  };
  for (const booking of bookings) {
    const kind = classifyBooking(booking.status, booking.date, today);
    if (kind) groups[kind].push(booking);
  }
  // Upcoming reads better ascending (nearest first); past + cancelled stay
  // descending (most recent first).
  groups.upcoming.reverse();

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

      <DashboardSection
        kind="upcoming"
        bookings={groups.upcoming}
        creditsBySource={creditsBySource}
        locale={locale}
        t={t}
        tStep1={tStep1}
      />
      <DashboardSection
        kind="past"
        bookings={groups.past}
        creditsBySource={creditsBySource}
        locale={locale}
        t={t}
        tStep1={tStep1}
      />
      <DashboardSection
        kind="cancelled"
        bookings={groups.cancelled}
        creditsBySource={creditsBySource}
        locale={locale}
        t={t}
        tStep1={tStep1}
      />

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

type SectionProps = {
  kind: SectionKind;
  bookings: BookingRow[];
  creditsBySource: Map<string, CreditRow>;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
  tStep1: Awaited<ReturnType<typeof getTranslations<"reservar.step1">>>;
};

function DashboardSection({
  kind,
  bookings,
  creditsBySource,
  locale,
  t,
  tStep1,
}: SectionProps) {
  const count = bookings.length;
  return (
    <section
      data-testid={`dashboard-section-${kind}`}
      data-section-count={count}
      className="mt-14"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-input pb-3">
        <h2
          data-testid={`dashboard-section-heading-${kind}`}
          className="font-display text-2xl tracking-tight"
        >
          {t(`section_${kind}`)}
        </h2>
        <span
          data-testid={`dashboard-section-count-${kind}`}
          className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          {count}
        </span>
      </div>

      {count === 0 ? (
        <SectionEmpty kind={kind} t={t} />
      ) : (
        <ol
          data-testid={`dashboard-bookings-${kind}`}
          className="divide-y divide-input"
        >
          {bookings.map((booking) => (
            <BookingRowItem
              key={booking.id}
              booking={booking}
              credit={creditsBySource.get(booking.id) ?? null}
              kind={kind}
              locale={locale}
              t={t}
              tStep1={tStep1}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function SectionEmpty({
  kind,
  t,
}: {
  kind: SectionKind;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
}) {
  return (
    <div
      data-testid={`dashboard-empty-${kind}`}
      className="mt-6 flex flex-col items-start gap-4 border-l-2 border-foreground/60 bg-muted/20 px-6 py-8"
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t(`empty_${kind}`)}
      </p>
      {kind === "upcoming" ? (
        <Link
          href="/reservar"
          data-testid="dashboard-empty-upcoming-cta"
          className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
        >
          {t("empty_upcoming_cta")}
        </Link>
      ) : null}
      {/* Empty-state CTA on `/${locale}/dashboard` lives in `upcoming`; past
          and cancelled empty states are intentionally informational only. */}
    </div>
  );
}

function BookingRowItem({
  booking,
  credit,
  kind,
  locale,
  t,
  tStep1,
}: {
  booking: BookingRow;
  credit: CreditRow | null;
  kind: SectionKind;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
  tStep1: Awaited<ReturnType<typeof getTranslations<"reservar.step1">>>;
}) {
  const statusLabel = t(STATUS_LABEL_KEY[booking.status]);
  const durationLabel = tStep1(DURATION_LABEL_KEY[booking.duration]);
  const instructorName = booking.instructor.user.name ?? "—";

  return (
    <li
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
          <span data-testid="dashboard-booking-time">{booking.anchorTime}</span>
          <span aria-hidden> · </span>
          <span data-testid="dashboard-booking-duration">{durationLabel}</span>
          <span aria-hidden> · </span>
          <span data-testid="dashboard-booking-instructor">
            {instructorName}
          </span>
        </p>
        {kind === "cancelled" ? (
          <CancelledMeta booking={booking} credit={credit} locale={locale} t={t} />
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <p
          data-testid="dashboard-booking-total"
          className="font-display text-2xl tracking-tight"
        >
          {formatChf(booking.totalPriceCents)}
        </p>
        {kind === "past" && booking.status === BookingStatus.COMPLETED ? (
          <a
            href={`/api/booking/${booking.id}/ics`}
            data-testid="dashboard-booking-ics"
            className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          >
            {t("add_to_calendar")} ↓
          </a>
        ) : null}
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
}

function CancelledMeta({
  booking,
  credit,
  locale,
  t,
}: {
  booking: BookingRow;
  credit: CreditRow | null;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
}) {
  const cancelledAt = booking.cancelledByUserAt ?? booking.cancelledByOpsAt;
  return (
    <div
      data-testid="dashboard-booking-cancelled-meta"
      className="space-y-1 pt-2 text-xs text-muted-foreground"
    >
      {cancelledAt ? (
        <p data-testid="dashboard-booking-cancelled-at">
          {t("cancelled_on", { date: formatShortDate(cancelledAt, locale) })}
        </p>
      ) : null}
      {booking.status === BookingStatus.REFUNDED && booking.refundedAt ? (
        <p data-testid="dashboard-booking-refunded-meta">
          {t("refunded_on", {
            date: formatShortDate(booking.refundedAt, locale),
            amount: formatChf(booking.refundAmountCents ?? booking.totalPriceCents),
          })}
        </p>
      ) : null}
      {booking.status === BookingStatus.CANCELLED_BY_OPS && booking.opsReason ? (
        <p data-testid="dashboard-booking-ops-reason">{booking.opsReason}</p>
      ) : null}
      {credit ? (
        <p
          data-testid="dashboard-booking-credit-issued"
          className="text-foreground"
        >
          {t("credit_issued", {
            amount: formatChf(credit.amountCents),
            expires: formatShortDate(credit.expiresAt, locale),
          })}
        </p>
      ) : null}
    </div>
  );
}
