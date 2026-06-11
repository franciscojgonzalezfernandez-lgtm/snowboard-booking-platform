import type { Metadata } from "next";
import { BookingStatus } from "@prisma/client";

import { Input } from "@/components/ui/input";
import {
  previewCancelDayWith,
  type CancelDayDeps,
  type CancelDayPreview,
} from "@/lib/booking/cancel-day";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";

import { CancelDayConfirm } from "./_components/cancel-day-confirm";
import { InstructorPicker } from "./_components/instructor-picker";

export const metadata: Metadata = {
  title: "Cancel day · Admin",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isValidDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Pending payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED_BY_USER: "Cancelled (user)",
  CANCELLED_BY_OPS: "Cancelled (ops)",
  CANCELLED_BY_SYSTEM: "Cancelled (system)",
  PAYMENT_FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

export default async function AdminCancelDayPage({ searchParams }: Props) {
  const params = await searchParams;
  const date = firstParam(params.date);
  const instructorIdParam = firstParam(params.instructor);
  const instructorId =
    instructorIdParam && instructorIdParam !== "all"
      ? instructorIdParam
      : undefined;

  const instructors = await prisma.instructor.findMany({
    where: { active: true },
    select: { id: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const instructorOptions = instructors.map((i) => ({
    id: i.id,
    name: i.user.name ?? i.user.email,
  }));

  let preview: CancelDayPreview | null = null;
  let invalidDate = false;
  if (isValidDate(date)) {
    const deps: CancelDayDeps = {
      prisma: prisma as unknown as CancelDayDeps["prisma"],
    };
    const res = await previewCancelDayWith(deps, { date, instructorId });
    if (res.ok) preview = res.preview;
    else invalidDate = true;
  } else if (date !== undefined) {
    invalidDate = true;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Ops
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          Cancel day
        </h1>
        <p className="text-sm text-muted-foreground">
          Closes every active booking on the chosen date in one batch. Each
          booking is refunded individually (cash to the card, credit re-emitted
          fresh) — partial failures are reported per row so you can retry just
          the affected ones.
        </p>
      </header>

      <form
        method="get"
        className="mt-8 grid gap-4 sm:grid-cols-[200px,1fr,auto] sm:items-end"
        data-testid="cancel-day-filter-form"
      >
        <div className="space-y-2">
          <label
            htmlFor="cancel-day-date"
            className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Date (UTC)
          </label>
          <Input
            id="cancel-day-date"
            type="date"
            name="date"
            defaultValue={date}
            data-testid="cancel-day-date-input"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cancel-day-instructor"
            className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Instructor
          </label>
          <InstructorPicker
            instructors={instructorOptions}
            selectedId={instructorIdParam ?? "all"}
          />
        </div>

        <button
          type="submit"
          data-testid="cancel-day-preview-submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-6 text-xs font-bold uppercase tracking-[0.18em] text-background hover:bg-foreground/90"
        >
          Preview
        </button>
      </form>

      {invalidDate ? (
        <p
          data-testid="cancel-day-error"
          className="mt-6 text-sm font-medium text-destructive"
        >
          Pick a valid date in `YYYY-MM-DD` format.
        </p>
      ) : null}

      {preview ? (
        <section
          className="mt-10 space-y-6"
          data-testid="cancel-day-preview"
        >
          <header className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Impact preview
            </p>
            <h2 className="font-display text-2xl tracking-tight">
              {preview.totals.bookingsCount}{" "}
              {preview.totals.bookingsCount === 1 ? "booking" : "bookings"} on{" "}
              {preview.date}
            </h2>
          </header>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat
              label="Bookings"
              value={String(preview.totals.bookingsCount)}
              testid="cancel-day-total-bookings"
            />
            <Stat
              label="Attendees"
              value={String(preview.totals.attendeesCount)}
              testid="cancel-day-total-attendees"
            />
            <Stat
              label="Cash refund"
              value={formatChf(preview.totals.cashRefundCents)}
              testid="cancel-day-total-cash"
            />
            <Stat
              label="Credit re-emit"
              value={formatChf(preview.totals.creditReEmitCents)}
              testid="cancel-day-total-credit"
            />
          </dl>

          {preview.bookings.length === 0 ? (
            <p
              data-testid="cancel-day-empty"
              className="rounded-lg border border-dashed border-input p-6 text-sm text-muted-foreground"
            >
              Nothing to cancel on this day — no active bookings match the
              filter.
            </p>
          ) : (
            <>
              <ul
                className="space-y-3"
                data-testid="cancel-day-booking-list"
              >
                {preview.bookings.map((b) => (
                  <li
                    key={b.id}
                    data-testid={`cancel-day-booking-${b.id}`}
                    className="grid gap-2 rounded-lg border border-input p-4 sm:grid-cols-[7rem,1fr,1fr,auto] sm:items-center"
                  >
                    <span className="font-mono text-sm">{b.anchorTime}</span>
                    <span className="text-sm">
                      <span className="block font-medium">
                        {b.bookerName ?? b.bookerEmail.split("@")[0]}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {b.bookerEmail}
                      </span>
                    </span>
                    <span className="text-sm">
                      <span className="block">
                        {b.instructorName ?? "(no name)"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {STATUS_LABEL[b.status]} · {b.attendeesCount}{" "}
                        {b.attendeesCount === 1 ? "attendee" : "attendees"}
                      </span>
                    </span>
                    <span className="text-right text-sm">
                      {b.cashRefundCents > 0 ? (
                        <span className="block">
                          refund {formatChf(b.cashRefundCents)}
                        </span>
                      ) : null}
                      {b.creditReEmitCents > 0 ? (
                        <span className="block">
                          credit {formatChf(b.creditReEmitCents)}
                        </span>
                      ) : null}
                      {b.cashRefundCents === 0 && b.creditReEmitCents === 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          nothing to refund
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>

              <CancelDayConfirm
                date={preview.date}
                instructorId={preview.instructorId}
                bookingsCount={preview.totals.bookingsCount}
              />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  testid,
}: {
  label: string;
  value: string;
  testid: string;
}) {
  return (
    <div className="rounded-lg border border-input p-4">
      <dt className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </dt>
      <dd
        data-testid={testid}
        className="mt-2 font-display text-2xl tracking-tight"
      >
        {value}
      </dd>
    </div>
  );
}
