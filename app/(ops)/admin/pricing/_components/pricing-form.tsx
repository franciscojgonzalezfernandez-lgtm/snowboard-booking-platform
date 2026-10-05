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
  DURATIONS,
  pricingFormSchema,
  type PricingFormInput,
  type UpdateSeasonPricingInput,
} from "@/lib/schemas/pricing";

import { updateSeasonPricing } from "../../actions";

const LOCALES = ["en", "de", "es"] as const;
const LOCALE_LABEL: Record<(typeof LOCALES)[number], string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
};

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the highlighted prices and promo fields and try again.",
  NO_ACTIVE_SEASON: "No active season — activate one before setting prices.",
  PROMO_REQUIRES_BANNER:
    "Add and enable at least one ad banner before saving a promotion — see Announcements.",
};

type PromoLabels = { en: string; de: string; es: string };

type PricingFormField = {
  duration: Duration;
  label: string;
  /** Current regular price in CHF francs, or null when unset. */
  francs: number | null;
  /** Current promo price in CHF francs, or null when not promoted. */
  promoFrancs: number | null;
  /** Current promo copy per locale (empty strings when not promoted). */
  promoLabels: PromoLabels;
};

export function PricingForm({ fields }: { fields: PricingFormField[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const byDuration = Object.fromEntries(
    fields.map((f) => [f.duration, f]),
  ) as Record<Duration, PricingFormField>;

  const form = useForm<PricingFormInput>({
    resolver: zodResolver(pricingFormSchema),
    mode: "onTouched",
    defaultValues: {
      ONE_HOUR: byDuration.ONE_HOUR?.francs ?? undefined,
      TWO_HOURS: byDuration.TWO_HOURS?.francs ?? undefined,
      INTENSIVE: byDuration.INTENSIVE?.francs ?? undefined,
      FULL_DAY: byDuration.FULL_DAY?.francs ?? undefined,
      promos: Object.fromEntries(
        DURATIONS.map((duration) => [
          duration,
          {
            price: byDuration[duration]?.promoFrancs ?? undefined,
            label: byDuration[duration]?.promoLabels ?? {
              en: "",
              de: "",
              es: "",
            },
          },
        ]),
      ),
    } as PricingFormInput,
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

    const promos: NonNullable<UpdateSeasonPricingInput["promos"]> = {};
    for (const duration of DURATIONS) {
      const promo = values.promos[duration];
      if (promo.price != null) {
        promos[duration] = {
          priceCents: francsToCents(promo.price),
          label: {
            en: promo.label.en.trim(),
            de: promo.label.de.trim(),
            es: promo.label.es.trim(),
          },
        };
      }
    }

    const input: UpdateSeasonPricingInput = {
      ONE_HOUR: francsToCents(values.ONE_HOUR),
      TWO_HOURS: francsToCents(values.TWO_HOURS),
      INTENSIVE: francsToCents(values.INTENSIVE),
      FULL_DAY: francsToCents(values.FULL_DAY),
      promos,
    };

    startTransition(async () => {
      const res = await updateSeasonPricing(input);
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
    setServerError("Check the highlighted prices and promo fields and try again.");
    const firstBadRegular = DURATIONS.find((d) => formErrors[d]);
    if (firstBadRegular) setFocus(firstBadRegular);
  }

  return (
    <form
      data-testid="pricing-form"
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-6"
    >
      <div className="space-y-6">
        {DURATIONS.map((duration) => {
          const label = byDuration[duration]?.label ?? duration;
          const rawRegular = watch(duration);
          const rawPromo = watch(`promos.${duration}.price`);
          const regularPreview =
            typeof rawRegular === "number" &&
            Number.isFinite(rawRegular) &&
            rawRegular > 0
              ? formatChf(francsToCents(rawRegular))
              : null;
          // Reveal the promo copy inputs as soon as a promo price is typed.
          const showPromoLabels =
            typeof rawPromo === "number" && !Number.isNaN(rawPromo);
          const promoPreview =
            typeof rawPromo === "number" &&
            Number.isFinite(rawPromo) &&
            rawPromo > 0
              ? formatChf(francsToCents(rawPromo))
              : null;
          const promoErrors = errors.promos?.[duration];

          return (
            <fieldset
              key={duration}
              className="space-y-4 border border-input p-5"
            >
              <legend className="px-1 text-sm font-bold uppercase tracking-[0.12em]">
                {label}
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Regular price */}
                <div className="space-y-1.5">
                  <Label htmlFor={`price-${duration}`}>Price</Label>
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
                  ) : regularPreview ? (
                    <p
                      data-testid={`price-preview-${duration}`}
                      className="text-xs text-muted-foreground"
                    >
                      {regularPreview}
                    </p>
                  ) : null}
                </div>

                {/* Promo price (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor={`promo-price-${duration}`}>
                    Promo price{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      CHF
                    </span>
                    <Input
                      id={`promo-price-${duration}`}
                      data-testid={`promo-price-${duration}`}
                      type="number"
                      inputMode="decimal"
                      step="0.05"
                      min="0"
                      className="pl-12 tabular-nums"
                      aria-invalid={promoErrors?.price ? "true" : "false"}
                      {...register(`promos.${duration}.price`, {
                        // Empty input → undefined (not promoted); otherwise a number.
                        setValueAs: (v: unknown) => {
                          if (v === "" || v === null || v === undefined)
                            return undefined;
                          const n = typeof v === "number" ? v : Number(v);
                          return Number.isNaN(n) ? undefined : n;
                        },
                      })}
                    />
                  </div>
                  {promoErrors?.price ? (
                    <p className="text-xs text-destructive" role="alert">
                      The promo price must be above 0 and below the regular
                      price.
                    </p>
                  ) : promoPreview ? (
                    <p
                      data-testid={`promo-price-preview-${duration}`}
                      className="text-xs text-muted-foreground"
                    >
                      {promoPreview}{" "}
                      {regularPreview ? (
                        <span className="line-through">{regularPreview}</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Promo copy — revealed only when a promo price is set. */}
              {showPromoLabels ? (
                <div
                  data-testid={`promo-labels-${duration}`}
                  className="space-y-3 border-l-2 border-primary/40 pl-4"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Promo text (shown to customers, all three required)
                  </p>
                  {LOCALES.map((locale) => {
                    const labelError = promoErrors?.label?.[locale];
                    return (
                      <div key={locale} className="space-y-1">
                        <Label
                          htmlFor={`promo-label-${duration}-${locale}`}
                          className="text-xs uppercase tracking-[0.1em] text-muted-foreground"
                        >
                          {LOCALE_LABEL[locale]}
                        </Label>
                        <Input
                          id={`promo-label-${duration}-${locale}`}
                          data-testid={`promo-label-${duration}-${locale}`}
                          type="text"
                          placeholder="e.g. Season opening"
                          aria-invalid={labelError ? "true" : "false"}
                          {...register(`promos.${duration}.label.${locale}`)}
                        />
                        {labelError ? (
                          <p className="text-xs text-destructive" role="alert">
                            Enter the promo text for {LOCALE_LABEL[locale]}.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </fieldset>
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
