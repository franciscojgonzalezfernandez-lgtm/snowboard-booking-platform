import { BookingStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { formatChf } from "@/lib/pricing/format";

import { formatShortDate } from "../_lib/format";
import type { BookingRow, CreditRow } from "../_lib/group";

type Props = {
  booking: BookingRow;
  credit: CreditRow | null;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
};

export function CancelledMeta({ booking, credit, locale, t }: Props) {
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
