import { getTranslations } from "next-intl/server";

import type { BookingRow, CreditRow, SectionKind } from "../_lib/group";
import { BookingRowItem } from "./booking-row";
import { SectionEmpty } from "./section-empty";

type Props = {
  kind: SectionKind;
  bookings: BookingRow[];
  creditsBySource: Map<string, CreditRow>;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>;
  tStep1: Awaited<ReturnType<typeof getTranslations<"reservar.step1">>>;
};

export function DashboardSection({
  kind,
  bookings,
  creditsBySource,
  locale,
  t,
  tStep1,
}: Props) {
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
