"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Duration } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { francsToCents } from "@/lib/pricing/chf";
import { formatChf } from "@/lib/pricing/format";
import {
  pricingFormSchema,
  type PricingFormInput,
} from "@/lib/schemas/pricing";

import { updateSeasonPricing } from "../../actions";

const FIELD_ORDER: Duration[] = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
];

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the highlighted prices and try again.",
  NO_ACTIVE_SEASON: "No active season — activate one before setting prices.",
};

type PricingFormField = {
  duration: Duration;
  label: string;
  /** Current price in CHF francs, or null when unset. */
  francs: number | null;
};

export function PricingForm({ fields }: { fields: PricingFormField[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const labelByDuration = Object.fromEntries(
    fields.map((f) => [f.duration, f.label]),
  ) as Record<Duration, string>;

  const form = useForm<PricingFormInput>({
    resolver: zodResolver(pricingFormSchema),
    mode: "onTouched",
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.duration, f.francs ?? undefined]),
    ) as PricingFormInput,
  });
  const {
    register,
    handleSubmit,
    setFocus,
    watch,
    formState: { errors },
  } = form;

  function onValid(values: PricingFormInput) {
    setServerError(null);
    // Convert francs → integer cents at the single boundary; the server
    // re-validates these as positive integers before persisting.
    const cents = {
      ONE_HOUR: francsToCents(values.ONE_HOUR),
      TWO_HOURS: francsToCents(values.TWO_HOURS),
      INTENSIVE: francsToCents(values.INTENSIVE),
      FULL_DAY: francsToCents(values.FULL_DAY),
    };
    startTransition(async () => {
      const res = await updateSeasonPricing(cents);
      if (res.ok) {
        router.refresh();
        toast.success("Prices updated.");
        return;
      }
      const message = ERROR_COPY[res.error] ?? "Could not update prices.";
      setServerError(message);
      toast.error(message);
    });
  }

  function onInvalid(formErrors: FieldErrors<PricingFormInput>) {
    setServerError("Check the highlighted prices and try again.");
    const first = FIELD_ORDER.find((d) => formErrors[d]);
    if (first) setFocus(first);
  }

  return (
    <form
      data-testid="pricing-form"
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELD_ORDER.map((duration) => {
          const raw = watch(duration);
          const preview =
            typeof raw === "number" && Number.isFinite(raw) && raw > 0
              ? formatChf(francsToCents(raw))
              : null;
          return (
            <div key={duration} className="space-y-1.5">
              <Label htmlFor={`price-${duration}`}>{labelByDuration[duration]}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  CHF
                </span>
                <Input
                  id={`price-${duration}`}
                  data-testid={`price-${duration}`}
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  min="0"
                  className="pl-12 tabular-nums"
                  aria-invalid={errors[duration] ? "true" : "false"}
                  {...register(duration, { valueAsNumber: true })}
                />
              </div>
              {errors[duration] ? (
                <p className="text-xs text-destructive" role="alert">
                  Enter a price above 0.
                </p>
              ) : preview ? (
                <p
                  data-testid={`price-preview-${duration}`}
                  className="text-xs text-muted-foreground"
                >
                  {preview}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {serverError ? (
        <p
          data-testid="pricing-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button type="submit" data-testid="pricing-submit" disabled={pending}>
        {pending ? "Saving…" : "Save prices"}
      </Button>
    </form>
  );
}
