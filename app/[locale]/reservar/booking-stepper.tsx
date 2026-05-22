"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { useBookingUrlState, type BookingUrlState } from "./use-booking-url-state";

const STEPS = [1, 2, 3, 4, 5] as const;
type Step = (typeof STEPS)[number];

const STEP_LABEL_KEY: Record<Step, string> = {
  1: "step1",
  2: "step2",
  3: "step3",
  4: "step4",
  5: "step5",
};

// During F-049 stage 2a only section 1 lives inside the shell; steps 2-5
// still serve from their own routes. The stepper falls back to a route push
// for any step the shell does not own yet, so the in-page jump can be wired
// progressively as stages 2b/2c land each section.
const STEP_FALLBACK_ROUTE: Record<Step, string | null> = {
  1: null,
  2: "/reservar/step-2",
  3: "/reservar/step-3",
  4: "/reservar/step-4",
  5: "/reservar/step-5",
};

function deriveCurrentStep(state: BookingUrlState): Step {
  if (!state.duration) return 1;
  if (!state.date) return 2;
  if (!state.time || !state.instructorId) return 3;
  return 4;
}

function deriveCompleted(state: BookingUrlState): ReadonlySet<Step> {
  const set = new Set<Step>();
  if (state.duration) set.add(1);
  if (state.duration && state.date) set.add(2);
  if (state.duration && state.date && state.time && state.instructorId) set.add(3);
  return set;
}

function buildLegacyHref(
  fallback: string,
  state: BookingUrlState,
  locale: string,
): string {
  const qs = new URLSearchParams();
  if (state.duration) qs.set("duration", state.duration);
  if (state.date) qs.set("date", state.date);
  if (state.time) qs.set("time", state.time);
  if (state.instructorId) qs.set("instructor", state.instructorId);
  if (state.language) qs.set("language", state.language);
  const query = qs.toString();
  return `/${locale}${fallback}${query ? `?${query}` : ""}`;
}

type Props = {
  locale: string;
};

export function BookingStepper({ locale }: Props) {
  const t = useTranslations("reservar.stepper");
  const { state } = useBookingUrlState();

  const current = useMemo(() => deriveCurrentStep(state), [state]);
  const completed = useMemo(() => deriveCompleted(state), [state]);

  const navigate = useCallback(
    (step: Step) => {
      const fallback = STEP_FALLBACK_ROUTE[step];
      if (fallback) {
        window.location.href = buildLegacyHref(fallback, state, locale);
        return;
      }
      const target = document.getElementById(`section-${step}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const focusable = target.querySelector<HTMLElement>(
        "[data-section-focus]",
      );
      focusable?.focus({ preventScroll: true });
    },
    [locale, state],
  );

  return (
    <nav
      data-testid="booking-stepper"
      aria-label={t("aria_label")}
      className="sticky top-0 z-30 border-b border-foreground/10 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <ol
        role="list"
        className="mx-auto hidden max-w-4xl grid-cols-5 items-stretch gap-2 px-6 py-3 md:grid"
      >
        {STEPS.map((step) => {
          const isCompleted = completed.has(step);
          const isActive = step === current;
          const isInteractive =
            isCompleted || isActive || (step <= current);
          const label = t(STEP_LABEL_KEY[step]);
          return (
            <li key={step} className="contents">
              <button
                type="button"
                data-testid={`stepper-step-${step}`}
                data-state={
                  isActive ? "active" : isCompleted ? "completed" : "pending"
                }
                aria-current={isActive ? "step" : undefined}
                disabled={!isInteractive}
                onClick={() => navigate(step)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed",
                  isActive
                    ? "text-foreground"
                    : isCompleted
                      ? "text-foreground/80 hover:text-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[12px] tracking-normal",
                    isActive && "border-foreground bg-foreground text-background",
                    isCompleted &&
                      !isActive &&
                      "border-foreground bg-background text-foreground",
                    !isActive &&
                      !isCompleted &&
                      "border-muted-foreground/30 text-muted-foreground/60",
                  )}
                >
                  {isCompleted && !isActive ? "✓" : step}
                </span>
                <span className="truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3 md:hidden">
        <p
          data-testid="stepper-mobile-summary"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {t("mobile_summary", { current, total: STEPS.length })}
        </p>
        <p
          data-testid="stepper-mobile-current-label"
          className="text-[12px] font-bold uppercase tracking-[0.18em] text-foreground"
        >
          {t(STEP_LABEL_KEY[current])}
        </p>
      </div>
    </nav>
  );
}
