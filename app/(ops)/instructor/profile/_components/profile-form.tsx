"use client";

import { useState, useTransition } from "react";
import {
  Controller,
  useForm,
  type FieldErrors,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Locale } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import {
  updateInstructorProfileSchema,
  type UpdateInstructorProfileInput,
} from "@/lib/schemas/instructor-profile";

import { updateInstructorProfile } from "../../actions";

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: Locale.en, label: "English" },
  { value: Locale.de, label: "Deutsch" },
  { value: Locale.es, label: "Español" },
];

const FIELD_ORDER: Path<UpdateInstructorProfileInput>[] = [
  "bio",
  "specialties",
  "languages",
  "active",
  "acceptsSameDayIfBooked",
];

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Some fields are not valid. Review the highlighted ones.",
  NOT_FOUND: "Your instructor profile was not found.",
};

type Props = {
  initial: UpdateInstructorProfileInput;
};

export function ProfileForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [specialtyDraft, setSpecialtyDraft] = useState("");

  const form = useForm<UpdateInstructorProfileInput>({
    resolver: zodResolver(updateInstructorProfileSchema),
    mode: "onTouched",
    defaultValues: initial,
  });
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const specialties = watch("specialties") ?? [];

  function addSpecialty() {
    const next = specialtyDraft.trim();
    if (!next) return;
    if (specialties.includes(next)) {
      setSpecialtyDraft("");
      return;
    }
    if (specialties.length >= 12) {
      toast.error("Up to 12 specialties.");
      return;
    }
    setValue("specialties", [...specialties, next], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSpecialtyDraft("");
  }

  function removeSpecialty(tag: string) {
    setValue(
      "specialties",
      specialties.filter((s) => s !== tag),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function onValid(values: UpdateInstructorProfileInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await updateInstructorProfile(values);
      if (res.ok) {
        toast.success("Profile saved.");
        return;
      }
      const message = ERROR_COPY[res.error] ?? "Could not save the profile.";
      setServerError(message);
      toast.error(message);
    });
  }

  function onInvalid(formErrors: FieldErrors<UpdateInstructorProfileInput>) {
    setServerError("Check the highlighted fields and try again.");
    focusFirstError(formErrors, setFocus, FIELD_ORDER);
  }

  return (
    <form
      data-testid="profile-form"
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-8"
    >
      <div className="space-y-1.5">
        <Label htmlFor="profile-bio">Bio</Label>
        <Textarea
          id="profile-bio"
          data-testid="profile-bio"
          rows={6}
          maxLength={2000}
          aria-invalid={errors.bio ? "true" : "false"}
          aria-describedby={errors.bio ? "profile-bio-error" : "profile-bio-hint"}
          {...register("bio")}
        />
        <p id="profile-bio-hint" className="text-xs text-muted-foreground">
          Up to 2000 characters. Two or three sentences works best.
        </p>
        {errors.bio ? (
          <p
            id="profile-bio-error"
            className="text-xs text-destructive"
            role="alert"
          >
            Bio is too long.
          </p>
        ) : null}
      </div>

      <Controller
        control={control}
        name="specialties"
        render={() => (
          <div className="space-y-2" data-testid="profile-specialties">
            <Label htmlFor="profile-specialty-input">Specialties</Label>
            <p className="text-xs text-muted-foreground">
              Up to 12 short tags. Press Enter to add.
            </p>
            <div className="flex flex-wrap gap-2">
              {specialties.map((tag) => (
                <span
                  key={tag}
                  data-testid={`profile-specialty-${tag}`}
                  className="inline-flex items-center gap-1 rounded-full border border-input bg-secondary/60 px-3 py-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    data-testid={`profile-specialty-remove-${tag}`}
                    onClick={() => removeSpecialty(tag)}
                    aria-label={`Remove ${tag}`}
                    className="font-bold text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="profile-specialty-input"
                data-testid="profile-specialty-input"
                value={specialtyDraft}
                onChange={(e) => setSpecialtyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpecialty();
                  }
                }}
                placeholder="Freestyle"
                maxLength={40}
              />
              <Button
                type="button"
                variant="outline"
                data-testid="profile-specialty-add"
                onClick={addSpecialty}
              >
                Add
              </Button>
            </div>
            {errors.specialties ? (
              <p className="text-xs text-destructive" role="alert">
                Specialties must be short and at most 12 in total.
              </p>
            ) : null}
          </div>
        )}
      />

      <Controller
        control={control}
        name="languages"
        render={({ field }) => (
          <div className="space-y-2" data-testid="profile-languages">
            <p className="text-sm font-medium">Languages I teach in</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {LANGUAGE_OPTIONS.map((opt) => {
                const checked = field.value.includes(opt.value);
                return (
                  <Label
                    key={opt.value}
                    className="inline-flex items-center gap-2 text-sm font-normal"
                  >
                    <Checkbox
                      data-testid={`profile-language-${opt.value}`}
                      checked={checked}
                      onCheckedChange={(value) => {
                        const next = value
                          ? Array.from(new Set([...field.value, opt.value]))
                          : field.value.filter((l) => l !== opt.value);
                        field.onChange(next);
                      }}
                    />
                    {opt.label}
                  </Label>
                );
              })}
            </div>
            {errors.languages ? (
              <p className="text-xs text-destructive" role="alert">
                Pick at least one language.
              </p>
            ) : null}
          </div>
        )}
      />

      <div className="space-y-2">
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Label className="inline-flex items-center gap-2 text-sm font-normal">
              <Checkbox
                data-testid="profile-active"
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
              />
              Accept new bookings
            </Label>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Uncheck to temporarily hide yourself from the booking funnel.
        </p>
      </div>

      <div className="space-y-2">
        <Controller
          control={control}
          name="acceptsSameDayIfBooked"
          render={({ field }) => (
            <Label className="inline-flex items-center gap-2 text-sm font-normal">
              <Checkbox
                data-testid="profile-same-day"
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
              />
              Allow same-day bookings when I already have a lesson that day
            </Label>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Off by default. Turn on if back-to-back classes are fine for you.
        </p>
      </div>

      {serverError ? (
        <p
          data-testid="profile-form-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        data-testid="profile-form-submit"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
