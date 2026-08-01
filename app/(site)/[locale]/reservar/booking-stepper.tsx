"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useDraftGuard } from "./draft-guard";
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

export function BookingStepper() {
  const t = useTranslations("reservar.stepper");
  const { state } = useBookingUrlState();
  const { requestEdit } = useDraftGuard();
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = useMemo(() => deriveCurrentStep(state), [state]);
  const completed = useMemo(() => deriveCompleted(state), [state]);

  const navigate = useCallback(
    (step: Step) => {
      requestEdit(() => {
        setMobileOpen(false);
        const target = document.getElementById(`section-${step}`);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        const focusable = target.querySelector<HTMLElement>(
          "[data-section-focus]",
        );
        focusable?.focus({ preventScroll: true });
      });
    },
    [requestEdit],
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

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          data-testid="stepper-mobile-trigger"
          aria-label={t("mobile_aria")}
          className="mx-auto flex min-h-11 w-full max-w-4xl items-center justify-between gap-3 px-6 py-3 text-left transition-colors hover:bg-foreground/[0.03] md:hidden"
        >
          <span
            data-testid="stepper-mobile-summary"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
          >
            {t("mobile_summary", { current, total: STEPS.length })}
          </span>
          <span className="flex items-center gap-2">
            <span
              data-testid="stepper-mobile-current-label"
              className="text-[12px] font-bold uppercase tracking-[0.18em] text-foreground"
            >
              {t(STEP_LABEL_KEY[current])}
            </span>
            <span aria-hidden="true" className="text-foreground/40">
              ▾
            </span>
          </span>
        </SheetTrigger>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl tracking-tight">
              {t("mobile_jump_title")}
            </SheetTitle>
          </SheetHeader>
          <ol role="list" className="mt-2 flex flex-col">
            {STEPS.map((step) => {
              const isCompleted = completed.has(step);
              const isActive = step === current;
              const isInteractive =
                isCompleted || isActive || step <= current;
              const label = t(STEP_LABEL_KEY[step]);
              return (
                <li key={step}>
                  <button
                    type="button"
                    data-testid={`stepper-mobile-step-${step}`}
                    data-state={
                      isActive
                        ? "active"
                        : isCompleted
                          ? "completed"
                          : "pending"
                    }
                    aria-current={isActive ? "step" : undefined}
                    disabled={!isInteractive}
                    onClick={() => navigate(step)}
                    className={cn(
                      "flex w-full items-center gap-4 border-b border-foreground/10 px-2 py-4 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      isInteractive && "hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm",
                        isActive &&
                          "border-foreground bg-foreground text-background",
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
                    <span
                      className={cn(
                        "text-sm font-bold uppercase tracking-[0.18em]",
                        isActive
                          ? "text-foreground"
                          : isCompleted
                            ? "text-foreground/80"
                            : "text-muted-foreground/60",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
