"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Duration, Level, Locale } from "@prisma/client";

import { TermsModal } from "@/app/components/TermsModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatChf } from "@/lib/pricing/format";
import {
  encodeAttendees,
  step4FormSchema,
  type Step4FormValues,
} from "@/lib/schemas/step4";
import type { CreateBookingDraftError } from "@/lib/schemas/booking-draft";
import { createBookingDraft } from "./actions";
import { useDraftGuard } from "./draft-guard";
import { FreezeWhileDraft } from "./freeze-while-draft";
import { PaymentBlock } from "./payment-block";
import { useBookingUrlState } from "./use-booking-url-state";

const NOTES_MAX = 500;
const ATTENDEES_MAX = 4;

const LEVELS = [
  Level.BEGINNER,
  Level.INTERMEDIATE,
  Level.ADVANCED,
  Level.EXPERT_FREESTYLE,
] as const;

type Props = {
  locale: string;
  publishableKey: string;
  bookerEmail: string;
  bookerName: string;
  duration: Duration;
  date: string;
  time: string;
  instructorId: string;
  language: Locale;
  durationLabel: string;
  instructorLabel: string;
  dateLabel: string;
  attendeeCountKey: string;
  section4: SectionCopy;
  section5: SectionCopy;
};

type SectionCopy = {
  eyebrow: string;
  heading: string;
  sub: string | null;
};

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusable = el.querySelector<HTMLElement>("[data-section-focus]");
  focusable?.focus({ preventScroll: true });
}

export function BookerPaymentFlow({
  locale,
  publishableKey,
  bookerEmail,
  bookerName,
  duration,
  date,
  time,
  instructorId,
  language,
  durationLabel,
  instructorLabel,
  dateLabel,
  attendeeCountKey,
  section4,
  section5,
}: Props) {
  const t = useTranslations("reservar.step4");
  const tStep5 = useTranslations("reservar.step5");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<{
    kind: CreateBookingDraftError | "GENERIC";
    message: string;
  } | null>(null);
  const { set } = useBookingUrlState();
  const { draft, registerDraft, clearDraft } = useDraftGuard();
  const lastDraftIdRef = useRef<string | null>(null);

  const form = useForm<Step4FormValues>({
    resolver: zodResolver(step4FormSchema) as Resolver<Step4FormValues>,
    mode: "onTouched",
    defaultValues: {
      bookerName: bookerName ?? "",
      bookerPhone: "+41 ",
      attendees: [
        {
          name: "",
          age: 18 as unknown as number,
          level: Level.BEGINNER,
        },
      ],
      notes: "",
      acceptedTerms: false as unknown as true,
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "attendees",
  });

  const notesValue = watch("notes") ?? "";
  const canRemoveAttendee = fields.length > 1;
  const canAddAttendee = fields.length < ATTENDEES_MAX;
  const attendeeCount = fields.length;

  // When a fresh draft is created, scroll the payment block into view on
  // the next paint so the user sees the Stripe Element + total without
  // hunting for it.
  useEffect(() => {
    if (draft && lastDraftIdRef.current !== draft.bookingId) {
      lastDraftIdRef.current = draft.bookingId;
      requestAnimationFrame(() => scrollToSection("section-5"));
    } else if (!draft) {
      lastDraftIdRef.current = null;
    }
  }, [draft]);

  // Upstream change (URL state) invalidates the active draft. The dirty-edit
  // guard intercepts in-app mutations and runs `voidActiveDraft` before the
  // URL state mutates; this effect is the safety net for unguarded paths
  // (browser back/forward, soft-nav from another tab, etc.) so the Payment
  // Element never floats on a stale clientSecret. Stripe-side cleanup of
  // the orphan PaymentIntent happens via the cron expiry path (F-048).
  useEffect(() => {
    clearDraft();
  }, [duration, date, time, instructorId, language, clearDraft]);

  function onSubmit(values: Step4FormValues) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createBookingDraft({
        date,
        time,
        duration,
        instructorId,
        language,
        bookerName: values.bookerName.trim(),
        bookerPhone: values.bookerPhone.replace(/\s+/g, ""),
        attendees: values.attendees,
        notes: values.notes?.trim() ?? "",
        acceptedTerms: true,
      });

      if (result.ok) {
        registerDraft({
          bookingId: result.bookingId,
          clientSecret: result.clientSecret,
          totalPriceCents: result.totalPriceCents,
        });
        return;
      }

      switch (result.error) {
        case "UNAUTHORIZED": {
          const next = `/${locale}/reservar?${new URLSearchParams({
            d: duration,
            dt: date,
            t: time,
            i: instructorId,
            l: language,
          }).toString()}`;
          router.push(`/${locale}/login?next=${encodeURIComponent(next)}`);
          return;
        }
        case "SLOT_TAKEN":
          setSubmitError({
            kind: "SLOT_TAKEN",
            message: tStep5("error_slot_taken_body"),
          });
          // Stale availability — refresh slot data + pull user back to
          // the calendar so they can repick. The attendees they entered
          // are preserved in form state during the scroll.
          queryClient.invalidateQueries({ queryKey: ["availability"] });
          set({
            time: undefined,
            instructorId: undefined,
            language: undefined,
          });
          requestAnimationFrame(() => scrollToSection("section-2"));
          return;
        case "PRICING_MISSING":
        case "NO_ACTIVE_SEASON":
          setSubmitError({
            kind: result.error,
            message: tStep5("error_pricing_body"),
          });
          return;
        case "INVALID_INPUT":
        default:
          setSubmitError({
            kind: "GENERIC",
            message: t("error_fallback"),
          });
          return;
      }
    });
  }

  // Build attendees-encoded payload server-action consumes directly; the
  // legacy /step-5 URL-encoded version is no longer needed but kept exported
  // by `lib/schemas/step4` for any external callers.
  void encodeAttendees;

  return (
    <>
      <FreezeWhileDraft>
        <section
          id="section-4"
          data-testid="section-4"
          aria-labelledby="section-4-heading"
          className="mt-16 scroll-mt-32"
        >
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
            {section4.eyebrow}
          </p>
          <h2
            id="section-4-heading"
            data-testid="step4-title"
            className="font-display text-3xl tracking-tight"
          >
            {section4.heading}
          </h2>
          {section4.sub ? (
            <p className="text-sm text-muted-foreground">{section4.sub}</p>
          ) : null}
        </header>

        <form
          data-testid="step4-form"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="mt-8 space-y-12"
        >
          <fieldset className="space-y-4" data-testid="step4-booker">
            <legend className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("booker_legend")}
            </legend>

            <div className="space-y-1.5">
              <label htmlFor="booker-name" className="text-sm font-medium">
                {t("booker_name_label")}
              </label>
              <Input
                id="booker-name"
                data-testid="booker-name"
                data-section-focus
                autoComplete="name"
                aria-invalid={errors.bookerName ? "true" : "false"}
                {...register("bookerName")}
              />
              {errors.bookerName ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.bookerName.message
                    ? t("error_name_too_long")
                    : t("error_required")}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="booker-email" className="text-sm font-medium">
                {t("booker_email_label")}
              </label>
              <Input
                id="booker-email"
                data-testid="booker-email"
                value={bookerEmail}
                readOnly
                aria-readonly="true"
                className="bg-muted/40"
              />
              <p className="text-xs text-muted-foreground">
                {t("booker_email_hint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="booker-phone" className="text-sm font-medium">
                {t("booker_phone_label")}
              </label>
              <Input
                id="booker-phone"
                data-testid="booker-phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+41 76 638 1870"
                aria-invalid={errors.bookerPhone ? "true" : "false"}
                {...register("bookerPhone")}
              />
              <p className="text-xs text-muted-foreground">
                {t("booker_phone_hint")}
              </p>
              {errors.bookerPhone ? (
                <p className="text-xs text-destructive" role="alert">
                  {t("error_phone_invalid")}
                </p>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="space-y-4" data-testid="step4-attendees">
            <legend className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("attendees_legend")}
            </legend>
            <p className="text-xs text-muted-foreground">{t("attendees_sub")}</p>

            <ul role="list" className="space-y-5">
              {fields.map((field, index) => {
                const attendeeErrors = errors.attendees?.[index];
                return (
                  <li
                    key={field.id}
                    data-testid={`attendee-${index}`}
                    className="space-y-3 rounded-md border border-input p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        {t("attendee_position", { position: index + 1 })}
                      </p>
                      {canRemoveAttendee ? (
                        <button
                          type="button"
                          data-testid={`attendee-${index}-remove`}
                          onClick={() => remove(index)}
                          className="text-xs font-medium uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                        >
                          {t("attendee_remove")}
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
                      <div className="space-y-1">
                        <label
                          htmlFor={`attendee-${index}-name`}
                          className="text-xs font-medium"
                        >
                          {t("attendee_name_label")}
                        </label>
                        <Input
                          id={`attendee-${index}-name`}
                          data-testid={`attendee-${index}-name`}
                          autoComplete="off"
                          aria-invalid={attendeeErrors?.name ? "true" : "false"}
                          {...register(`attendees.${index}.name`)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor={`attendee-${index}-age`}
                          className="text-xs font-medium"
                        >
                          {t("attendee_age_label")}
                        </label>
                        <Input
                          id={`attendee-${index}-age`}
                          data-testid={`attendee-${index}-age`}
                          type="number"
                          inputMode="numeric"
                          min={4}
                          max={99}
                          aria-invalid={attendeeErrors?.age ? "true" : "false"}
                          {...register(`attendees.${index}.age`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor={`attendee-${index}-level`}
                          className="text-xs font-medium"
                        >
                          {t("attendee_level_label")}
                        </label>
                        <Controller
                          control={control}
                          name={`attendees.${index}.level`}
                          render={({ field: levelField }) => (
                            <Select
                              value={levelField.value}
                              onValueChange={(value) =>
                                levelField.onChange(value as Level)
                              }
                            >
                              <SelectTrigger
                                id={`attendee-${index}-level`}
                                data-testid={`attendee-${index}-level`}
                                className="w-full"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LEVELS.map((level) => (
                                  <SelectItem
                                    key={level}
                                    value={level}
                                    data-testid={`attendee-${index}-level-${level}`}
                                  >
                                    {t(`level_${level}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    {(attendeeErrors?.name ||
                      attendeeErrors?.age ||
                      attendeeErrors?.level) && (
                      <p
                        className="text-xs text-destructive"
                        data-testid={`attendee-${index}-error`}
                        role="alert"
                      >
                        {attendeeErrors?.age
                          ? t("error_age_range")
                          : t("error_required")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              variant="outline"
              data-testid="attendee-add"
              disabled={!canAddAttendee}
              onClick={() =>
                append(
                  {
                    name: "",
                    age: 18 as unknown as number,
                    level: Level.BEGINNER,
                  },
                  { shouldFocus: false },
                )
              }
            >
              {t("attendee_add")}
            </Button>
          </fieldset>

          <fieldset className="space-y-3" data-testid="step4-notes">
            <legend className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("notes_legend")}
            </legend>
            <label htmlFor="notes" className="sr-only">
              {t("notes_label")}
            </label>
            <Textarea
              id="notes"
              data-testid="notes"
              rows={4}
              maxLength={NOTES_MAX}
              placeholder={t("notes_placeholder")}
              aria-invalid={errors.notes ? "true" : "false"}
              {...register("notes")}
            />
            <p
              className="text-right text-xs text-muted-foreground"
              data-testid="notes-counter"
            >
              {t("notes_counter", { count: notesValue.length, max: NOTES_MAX })}
            </p>
            {errors.notes ? (
              <p className="text-xs text-destructive" role="alert">
                {t("error_notes_too_long", { max: NOTES_MAX })}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-3" data-testid="step4-terms">
            <legend className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("terms_legend")}
            </legend>
            <Controller
              control={control}
              name="acceptedTerms"
              render={({ field: termsField }) => (
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    data-testid="terms-checkbox"
                    checked={Boolean(termsField.value)}
                    onCheckedChange={(value) =>
                      termsField.onChange(value === true)
                    }
                    aria-invalid={errors.acceptedTerms ? "true" : "false"}
                    className="mt-0.5"
                  />
                  <span className="leading-relaxed">
                    {t("terms_label_prefix")}
                    <TermsModal variant="terms">
                      {t("terms_label_terms")}
                    </TermsModal>
                    {t("terms_label_and")}
                    <TermsModal variant="privacy">
                      {t("terms_label_privacy")}
                    </TermsModal>
                    {t("terms_label_suffix")}
                  </span>
                </label>
              )}
            />
            {errors.acceptedTerms ? (
              <p
                className="text-xs text-destructive"
                data-testid="terms-error"
                role="alert"
              >
                {t("error_terms_required")}
              </p>
            ) : null}
          </fieldset>

          {submitError ? (
            <p
              data-testid="step4-submit-error"
              role="alert"
              aria-live="assertive"
              className="text-sm text-destructive"
            >
              {submitError.message}
            </p>
          ) : null}

          <div>
            <Button
              type="submit"
              data-testid="step4-submit"
              disabled={pending || !isValid}
              className="w-full sm:w-auto"
            >
              {pending ? t("submit_working") : t("submit")}
            </Button>
          </div>
        </form>
        </section>
      </FreezeWhileDraft>

      {draft ? (
        <section
          id="section-5"
          data-testid="section-5"
          data-booking-id={draft.bookingId}
          aria-labelledby="section-5-heading"
          className="mt-16 scroll-mt-32"
        >
          <header className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
              {section5.eyebrow}
            </p>
            <h2
              id="section-5-heading"
              data-testid="step5-title"
              className="font-display text-3xl tracking-tight"
            >
              {section5.heading}
            </h2>
            {section5.sub ? (
              <p className="text-sm text-muted-foreground">{section5.sub}</p>
            ) : null}
          </header>

          <div className="mt-8 grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
            <aside
              data-testid="step5-summary"
              className="space-y-3 rounded-md border border-input p-5 text-sm"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {tStep5("summary_legend")}
              </p>
              <dl className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {tStep5("summary_duration")}
                  </dt>
                  <dd
                    className="font-medium"
                    data-testid="step5-summary-duration"
                  >
                    {durationLabel}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {tStep5("summary_date")}
                  </dt>
                  <dd className="font-medium" data-testid="step5-summary-date">
                    {dateLabel}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {tStep5("summary_time")}
                  </dt>
                  <dd className="font-medium" data-testid="step5-summary-time">
                    {time}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {tStep5("summary_instructor")}
                  </dt>
                  <dd
                    className="font-medium"
                    data-testid="step5-summary-instructor"
                  >
                    {instructorLabel}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {tStep5("summary_attendees")}
                  </dt>
                  <dd
                    className="font-medium"
                    data-testid="step5-summary-attendees"
                  >
                    {tStep5(attendeeCountKey, { count: attendeeCount })}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-input pt-3">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {tStep5("summary_total")}
                </span>
                <span
                  className="font-display text-2xl tracking-tight"
                  data-testid="step5-summary-total"
                >
                  {formatChf(draft.totalPriceCents)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tStep5("summary_vat_note")}
              </p>
            </aside>

            <PaymentBlock
              locale={locale}
              publishableKey={publishableKey}
              clientSecret={draft.clientSecret}
              bookingId={draft.bookingId}
              totalLabel={formatChf(draft.totalPriceCents)}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
