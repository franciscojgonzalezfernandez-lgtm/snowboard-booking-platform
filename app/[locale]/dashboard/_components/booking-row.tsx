import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { CREDIT_WINDOW_HOURS } from "@/lib/booking/cancel";
import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import { formatChf } from "@/lib/pricing/format";

import {
  DURATION_LABEL_KEY,
  STATUS_LABEL_KEY,
  formatBookingDate,
} from "../_lib/format";
import type { BookingRow as BookingRowData, CreditRow, SectionKind } from "../_lib/group";
import { CancelledMeta } from "./cancelled-meta";
import { CancelModal } from "./cancel-modal";

type Props = {
  booking: BookingRowData;
  credit: CreditRow | null;
  kind: SectionKind;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
  tStep1: Awaited<ReturnType<typeof getTranslations<"reservar.step1">>>;
};

export function BookingRowItem({
  booking,
  credit,
  kind,
  locale,
  t,
  tStep1,
}: Props) {
  const statusLabel = t(STATUS_LABEL_KEY[booking.status]);
  const durationLabel = tStep1(DURATION_LABEL_KEY[booking.duration]);
  const instructorName = booking.instructor.user.name ?? "—";

  // Upcoming rows are always CONFIRMED (paid), so the credit branch is driven
  // purely by the 48h window. The server action re-checks both; this only
  // chooses the modal copy.
  const canCancel = kind === "upcoming";
  const startDateTime = setUtcTime(startOfUtcDay(booking.date), booking.anchorTime);
  const hoursBeforeStart =
    (startDateTime.getTime() - Date.now()) / (60 * 60 * 1000);
  const earnsCredit = hoursBeforeStart >= CREDIT_WINDOW_HOURS;

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
        {canCancel ? (
          <CancelModal
            bookingId={booking.id}
            earnsCredit={earnsCredit}
            creditAmountLabel={formatChf(booking.totalPriceCents)}
          />
        ) : null}
        <p
          data-testid="dashboard-booking-total"
          className="font-display text-2xl tracking-tight"
        >
          {formatChf(booking.totalPriceCents)}
        </p>
        {kind === "pending" ? (
          <Link
            href={`/reservar/pago/${booking.id}`}
            data-testid="dashboard-booking-resume"
            className="inline-flex items-center justify-center rounded-md border-2 border-foreground bg-foreground px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-destructive hover:border-destructive"
          >
            {t("resume_payment")}
          </Link>
        ) : null}
        {kind === "upcoming" || kind === "past" ? (
          <Link
            href={`/reservar/exito/${booking.id}`}
            data-testid="dashboard-booking-link"
            className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          >
            {t("view_details")} →
          </Link>
        ) : null}
      </div>
    </li>
  );
}
