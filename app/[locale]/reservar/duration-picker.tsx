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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDraftGuard } from "./draft-guard";
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
  const { state, set } = useBookingUrlState();
  const { requestEdit } = useDraftGuard();
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
    requestEdit(() => {
      // Changing the duration invalidates every downstream selection (date /
      // time / instructor / language are scoped to a duration). Pass
      // `undefined` to drop the keys from the URL so the calendar /
      // time-instructor islands rehydrate from a clean slate. Tanstack keys
      // are duration-scoped, so the new duration auto-fetches its own data —
      // no explicit invalidation needed.
      set({
        duration: values.duration,
        date: undefined,
        time: undefined,
        instructorId: undefined,
        language: undefined,
      });

      requestAnimationFrame(() => {
        const inlineCalendar = document.getElementById("section-2");
        if (!inlineCalendar) return;
        inlineCalendar.scrollIntoView({ behavior: "smooth", block: "start" });
        const focusable = inlineCalendar.querySelector<HTMLElement>(
          "[data-section-focus]",
        );
        focusable?.focus({ preventScroll: true });
      });
    });
  }

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
                  {/*
                    Base UI Select treats `value === undefined` as uncontrolled
                    and any other value (including "") as controlled. RHF
                    seeds field.value with "" so we must keep passing that
                    empty string instead of coercing it to undefined — the
                    previous `field.value || undefined` flipped the component
                    from uncontrolled → controlled on first selection, which
                    Base UI rejects (it actually stops dispatching change
                    events, breaking the funnel before Step 2).
                  */}
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) =>
                      field.onChange(v as FormValues["duration"])
                    }
                  >
                    <SelectTrigger
                      id="duration-picker-select"
                      data-testid="select-duration"
                      data-section-focus
                      aria-invalid={!!fieldState.error}
                      className="h-11 w-full text-base md:h-10 md:text-sm"
                    >
                      <SelectValue placeholder={t("duration_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem
                          key={d}
                          value={d}
                          data-testid={`select-duration-${d}`}
                        >
                          {t(DURATION_LABEL_KEYS[d])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
