"use client";

import { useTransition } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Level } from "@prisma/client";

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
import {
  encodeAttendees,
  step4FormSchema,
  type Step4FormValues,
} from "@/lib/schemas/step4";

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
  bookerEmail: string;
  bookerName: string;
  duration: string;
  date: string;
  time: string;
  instructor: string;
  language: string;
};

export function Step4Form({
  locale,
  bookerEmail,
  bookerName,
  duration,
  date,
  time,
  instructor,
  language,
}: Props) {
  const t = useTranslations("reservar.step4");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  function onSubmit(values: Step4FormValues) {
    startTransition(() => {
      const qs = new URLSearchParams();
      if (duration) qs.set("duration", duration);
      if (date) qs.set("date", date);
      if (time) qs.set("time", time);
      if (instructor) qs.set("instructor", instructor);
      if (language) qs.set("language", language);
      qs.set("bookerName", values.bookerName.trim());
      qs.set("bookerPhone", values.bookerPhone.replace(/\s+/g, ""));
      qs.set("attendees", encodeAttendees(values.attendees));
      if (values.notes && values.notes.trim().length > 0) {
        qs.set("notes", values.notes.trim());
      }
      router.push(`/${locale}/reservar/step-5?${qs.toString()}`);
    });
  }

  return (
    <form
      data-testid="step4-form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-12"
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
  );
}
