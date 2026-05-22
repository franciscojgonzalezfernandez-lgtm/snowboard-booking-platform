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
    weekday: "short",
    day: "numeric",
    month: "short",
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
      where: { bookerId: userId },
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

  return (
    <main
      data-testid="dashboard-page"
      className="mx-auto max-w-4xl px-6 py-16"
    >
      <header className="space-y-2">
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
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
      </header>

      {bookings.length === 0 ? (
        <section
          data-testid="dashboard-empty"
          className="mt-10 rounded-md border border-input p-8 text-center"
        >
          <p className="font-display text-2xl tracking-tight">
            {t("empty_heading")}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("empty_body")}
          </p>
          <Link
            href="/reservar"
            data-testid="dashboard-empty-cta"
            className="mt-6 inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
          >
            {t("empty_cta")}
          </Link>
        </section>
      ) : (
        <section
          data-testid="dashboard-bookings"
          className="mt-10 overflow-hidden rounded-md border border-input"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-input bg-muted/30 text-left text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {t("col_date")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("col_time")}
                </th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell">
                  {t("col_duration")}
                </th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">
                  {t("col_instructor")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("col_status")}
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  {t("col_total")}
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">{t("col_actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const statusLabel = t(STATUS_LABEL_KEY[booking.status]);
                const durationLabel = tStep1(
                  DURATION_LABEL_KEY[booking.duration],
                );
                const instructorName = booking.instructor.user.name ?? "—";
                return (
                  <tr
                    key={booking.id}
                    data-testid="dashboard-booking-row"
                    data-booking-id={booking.id}
                    data-status={booking.status}
                    className="border-t border-input first:border-t-0"
                  >
                    <td className="px-4 py-4 font-medium">
                      {formatBookingDate(booking.date, locale)}
                    </td>
                    <td className="px-4 py-4">{booking.anchorTime}</td>
                    <td className="hidden px-4 py-4 sm:table-cell">
                      {durationLabel}
                    </td>
                    <td className="hidden px-4 py-4 md:table-cell">
                      {instructorName}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        data-testid="dashboard-booking-status"
                        className="inline-flex items-center rounded-full border border-input px-2 py-0.5 text-xs font-medium uppercase tracking-[0.1em]"
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium">
                      {formatChf(booking.totalPriceCents)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/reservar/exito/${booking.id}`}
                        data-testid="dashboard-booking-link"
                        className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                      >
                        {t("view_details")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section
        data-testid="dashboard-account"
        className="mt-12 rounded-md border border-input p-5"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("personal_heading")}
        </p>
        <dl className="mt-3 grid grid-cols-[max-content,1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("personal_name")}</dt>
          <dd data-testid="dashboard-account-name" className="font-medium">
            {account?.name ?? "—"}
          </dd>
          <dt className="text-muted-foreground">{t("personal_email")}</dt>
          <dd data-testid="dashboard-account-email" className="font-medium">
            {account?.email ?? "—"}
          </dd>
          <dt className="text-muted-foreground">{t("personal_phone")}</dt>
          <dd data-testid="dashboard-account-phone" className="font-medium">
            {account?.phone ?? t("personal_phone_missing")}
          </dd>
        </dl>
      </section>
    </main>
  );
}
