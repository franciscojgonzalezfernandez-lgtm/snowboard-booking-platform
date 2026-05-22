"use client";

import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Duration } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { useBookingUrlState } from "./use-booking-url-state";

// TODO(F-035): source durations from the backend (Season config) instead of
// hardcoding them here. Today the four-option enum is duplicated between this
// client and the Prisma `Duration` enum; once F-022 ships the booking engine,
// expose `GET /api/seasons/active` (or include in `/api/availability/calendar`
// bootstrap) so adding a new duration only requires a season edit.
const DURATIONS = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
] as const;

const DURATION_LABEL_KEYS: Record<(typeof DURATIONS)[number], string> = {
  [Duration.ONE_HOUR]: "duration_1h",
  [Duration.TWO_HOURS]: "duration_2h",
  [Duration.INTENSIVE]: "duration_4h",
  [Duration.FULL_DAY]: "duration_6h",
};

type Props = {
  initialDuration?: Duration;
};

export function DurationPicker({ initialDuration }: Props) {
  const t = useTranslations("reservar.step1");
  const router = useRouter();
  const { state, set } = useBookingUrlState();
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        duration: z.enum(DURATIONS, {
          message: t("validation_duration_required"),
        }),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const urlDuration = useMemo<Duration | undefined>(() => {
    if (!state.duration) return undefined;
    return (DURATIONS as readonly string[]).includes(state.duration)
      ? (state.duration as Duration)
      : undefined;
  }, [state.duration]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      duration: (urlDuration ?? initialDuration ?? "") as FormValues["duration"],
    },
  });

  // Keep RHF in sync if another island (or a back/forward) mutates the URL.
  useEffect(() => {
    if (urlDuration && urlDuration !== form.getValues("duration")) {
      form.setValue("duration", urlDuration, { shouldDirty: false });
    }
  }, [urlDuration, form]);

  function onSubmit(values: FormValues) {
    // Changing the duration invalidates every downstream selection (date /
    // time / instructor / language are scoped to a duration). Pass `undefined`
    // to drop the keys from the URL so the calendar / time-instructor islands
    // rehydrate from a clean slate. Tanstack keys are duration-scoped, so the
    // new duration auto-fetches its own data — no explicit invalidation needed.
    set({
      duration: values.duration,
      date: undefined,
      time: undefined,
      instructorId: undefined,
      language: undefined,
    });

    // Section 2 (calendar) ships inline as of stage 2b. If for some reason the
    // section element is not in the DOM (e.g. stale 2a fallback), route to the
    // legacy /step-2 page so the funnel still completes.
    const inlineCalendar = document.getElementById("section-2");
    if (inlineCalendar) {
      requestAnimationFrame(() => {
        inlineCalendar.scrollIntoView({ behavior: "smooth", block: "start" });
        const focusable = inlineCalendar.querySelector<HTMLElement>(
          "[data-section-focus]",
        );
        focusable?.focus({ preventScroll: true });
      });
      return;
    }

    const qs = new URLSearchParams({ duration: values.duration });
    router.push(`/reservar/step-2?${qs.toString()}`);
  }

  const selectClass = cn(
    "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "md:text-sm",
  );

  return (
    <div ref={sectionRef} data-testid="duration-picker">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
          noValidate
        >
          <FormField
            control={form.control}
            name="duration"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel htmlFor="duration-picker-select">
                  {t("duration_label")}
                </FormLabel>
                <FormControl>
                  <select
                    {...field}
                    id="duration-picker-select"
                    data-testid="select-duration"
                    data-section-focus
                    aria-invalid={!!fieldState.error}
                    className={selectClass}
                    value={field.value ?? ""}
                  >
                    <option value="" disabled>
                      {t("duration_placeholder")}
                    </option>
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {t(DURATION_LABEL_KEYS[d])}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            data-testid="submit-step1"
            className="w-full sm:w-auto"
          >
            {t("cta_continue")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
