"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { rescheduleBooking } from "./actions";

type Props = {
  bookingId: string;
  locale: string;
  durationLabel: string;
  current: { dateLabel: string; time: string };
  next: {
    date: string;
    dateLabel: string;
    time: string;
    instructorId: string;
    instructorName: string;
  };
};

/**
 * F-157: the reschedule funnel's final step. Replaces Section 4/5 (auth +
 * payment) — a move takes no payment. Shows current → new and confirms the move
 * via the `rescheduleBooking` Server Action, which re-validates every rule
 * server-side (ownership, 48h window, 1-year horizon, availability).
 */
export function RescheduleConfirm({
  bookingId,
  locale,
  durationLabel,
  current,
  next,
}: Props) {
  const t = useTranslations("reservar.reschedule");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The funnel has no sonner Toaster (unlike the dashboard), so errors are shown
  // inline here. Success is signalled by navigating to the dashboard, where the
  // moved booking is visible with its new time.
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await rescheduleBooking({
        bookingId,
        newDate: next.date,
        newAnchorTime: next.time,
        newInstructorId: next.instructorId,
      });

      if (result.ok) {
        router.push(`/${locale}/dashboard`);
        router.refresh();
        return;
      }

      setError(errorMessage(t, result.error));
      if (result.error === "SLOT_TAKEN") {
        // The slot was taken between picking and confirming — send them back to
        // the time grid to choose another.
        document
          .getElementById("section-3")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  return (
    <section
      id="section-4"
      data-testid="section-4-reschedule"
      aria-labelledby="section-4-reschedule-heading"
      className="mt-16 scroll-mt-32 rounded-md border border-input p-6"
    >
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
        {t("confirm_eyebrow")}
      </p>
      <h2
        id="section-4-reschedule-heading"
        className="mt-2 font-display text-3xl tracking-tight"
      >
        {t("confirm_heading")}
      </h2>

      <dl className="mt-6 space-y-4">
        <div className="flex items-baseline justify-between gap-4 opacity-70">
          <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("summary_from")}
          </dt>
          <dd
            data-testid="reschedule-current"
            className="text-right text-sm line-through"
          >
            {current.dateLabel} · {current.time}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("summary_to")}
          </dt>
          <dd data-testid="reschedule-next" className="text-right text-sm font-medium">
            {next.dateLabel} · {next.time}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("summary_length")}
          </dt>
          <dd className="text-right text-sm">{durationLabel}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("summary_instructor")}
          </dt>
          <dd className="text-right text-sm">{next.instructorName}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-muted-foreground">{t("no_charge_note")}</p>

      {error ? (
        <p
          data-testid="reschedule-error"
          role="alert"
          className="mt-4 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        data-testid="reschedule-confirm"
        data-section-focus
        onClick={handleConfirm}
        disabled={pending}
        className="mt-6 w-full sm:w-auto"
      >
        {pending ? t("confirm_pending") : t("confirm_cta")}
      </Button>
    </section>
  );
}

type TFn = ReturnType<typeof useTranslations<"reservar.reschedule">>;

function errorMessage(t: TFn, error: string): string {
  switch (error) {
    case "TOO_LATE":
      return t("error_too_late");
    case "OUTSIDE_HORIZON":
      return t("error_outside_horizon");
    case "SLOT_TAKEN":
      return t("error_slot_taken");
    case "SAME_SLOT":
      return t("error_same_slot");
    case "NOT_RESCHEDULABLE":
      return t("error_not_reschedulable");
    default:
      return t("error_generic");
  }
}
