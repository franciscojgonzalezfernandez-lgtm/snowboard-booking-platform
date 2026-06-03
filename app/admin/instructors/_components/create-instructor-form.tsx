"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Locale } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createInstructorSchema,
  type CreateInstructorInput,
} from "@/lib/schemas/instructor";

import { createInstructor } from "../../actions";

const ALL_LOCALES: Locale[] = [Locale.en, Locale.de, Locale.es];

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the highlighted fields and try again.",
  EMAIL_TAKEN: "An account with that email already exists.",
};

const FIELD_ORDER: (keyof CreateInstructorInput)[] = [
  "name",
  "email",
  "languages",
  "bio",
];

export function CreateInstructorForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateInstructorInput>({
    resolver: zodResolver(createInstructorSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      bio: "",
      languages: [Locale.en],
      specialties: [],
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors },
  } = form;

  function onValid(values: CreateInstructorInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await createInstructor(values);
      if (res.ok) {
        reset();
        router.refresh();
        toast.success("Instructor created.");
        return;
      }
      const message = ERROR_COPY[res.error] ?? "Could not create the instructor.";
      setServerError(message);
      toast.error(message);
    });
  }

  function onInvalid(formErrors: FieldErrors<CreateInstructorInput>) {
    setServerError("Check the highlighted fields and try again.");
    const first = FIELD_ORDER.find((k) => formErrors[k]);
    if (first) setFocus(first);
  }

  return (
    <form
      data-testid="instructor-create-form"
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="instructor-name">Name</Label>
          <Input
            id="instructor-name"
            data-testid="instructor-name"
            aria-invalid={errors.name ? "true" : "false"}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs text-destructive" role="alert">
              Enter a name.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instructor-email">Email</Label>
          <Input
            id="instructor-email"
            data-testid="instructor-email"
            type="email"
            aria-invalid={errors.email ? "true" : "false"}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-destructive" role="alert">
              Enter a valid email.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Languages</Label>
        <Controller
          control={control}
          name="languages"
          render={({ field }) => (
            <div className="flex flex-wrap gap-4" data-testid="instructor-languages">
              {ALL_LOCALES.map((locale) => {
                const checked = field.value?.includes(locale) ?? false;
                return (
                  <label
                    key={locale}
                    className="flex items-center gap-2 text-sm uppercase tracking-wider"
                  >
                    <Checkbox
                      data-testid={`instructor-language-${locale}`}
                      checked={checked}
                      onCheckedChange={(value) => {
                        const next =
                          value === true
                            ? [...(field.value ?? []), locale]
                            : (field.value ?? []).filter((l) => l !== locale);
                        field.onChange(next);
                      }}
                    />
                    {locale}
                  </label>
                );
              })}
            </div>
          )}
        />
        {errors.languages ? (
          <p className="text-xs text-destructive" role="alert">
            Pick at least one language.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instructor-specialties">Specialties</Label>
        <Input
          id="instructor-specialties"
          data-testid="instructor-specialties"
          placeholder="freestyle, powder, kids-4-12"
          {...register("specialties", {
            setValueAs: (v: unknown) =>
              typeof v === "string"
                ? v.split(",").map((s) => s.trim()).filter(Boolean)
                : (v ?? []),
          })}
        />
        <p className="text-xs text-muted-foreground">Comma-separated.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instructor-bio">Bio</Label>
        <Textarea
          id="instructor-bio"
          data-testid="instructor-bio"
          rows={4}
          aria-invalid={errors.bio ? "true" : "false"}
          {...register("bio")}
        />
        {errors.bio ? (
          <p className="text-xs text-destructive" role="alert">
            Keep the bio under 2000 characters.
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p
          data-testid="instructor-create-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button type="submit" data-testid="instructor-create-submit" disabled={pending}>
        {pending ? "Creating…" : "Create instructor"}
      </Button>
    </form>
  );
}
